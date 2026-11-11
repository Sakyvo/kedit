using System;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;

internal sealed class Request {
    public int version { get; set; }
    public string action { get; set; }
    public string requestId { get; set; }
    public string[] names { get; set; }
}

internal static class Program {
    [DllImport("user32.dll")] static extern bool OpenClipboard(IntPtr owner);
    [DllImport("user32.dll")] static extern bool CloseClipboard();
    [DllImport("user32.dll")] static extern IntPtr GetClipboardData(uint format);
    [DllImport("user32.dll")] static extern uint GetClipboardSequenceNumber();
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    static extern uint DragQueryFileW(IntPtr drop, uint index, StringBuilder path, uint size);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    static extern uint GetFileAttributesW(string path);
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 1048576 };
    static readonly UTF8Encoding Utf8 = new UTF8Encoding(false, true);

    static bool ValidRequest(Request request) {
        return request != null && request.version == 1 && request.action == "readFolders"
            && request.requestId != null && Regex.IsMatch(request.requestId, @"\A[a-zA-Z0-9-]{1,80}\z")
            && request.names != null && request.names.Length <= 256
            && request.names.All(name => name != null && name.Length <= 32767);
    }

    static object Reply(string id, string status, string[] paths = null) {
        return new { version = 1, requestId = id, status = status, paths = paths };
    }

    static string DisplayPath(string path) {
        if (path.StartsWith(@"\\?\UNC\", StringComparison.OrdinalIgnoreCase)) return @"\\" + path.Substring(8);
        if (path.StartsWith(@"\\?\", StringComparison.Ordinal)) return path.Substring(4);
        return path;
    }

    static bool ValidPaths(string[] paths) {
        return paths.Length > 0 && paths.Length <= 256 && paths.Sum(path => path.Length + 1) <= 131072
            && paths.All(path => path.Length <= 32767
                && Regex.IsMatch(path, @"\A(?:[a-zA-Z]:\\|\\\\[^\\]+\\[^\\]+)")
                && !Regex.IsMatch(path, "[\\x00-\\x1f\"<>|?*]"));
    }

    static bool NamesMatch(string[] paths, string[] names) {
        if (names.Length == 0) return true; // Chromium may expose no folder entries.
        var actual = paths.Select(path => Path.GetFileName(path.TrimEnd('\\'))).OrderBy(x => x, StringComparer.OrdinalIgnoreCase);
        return actual.SequenceEqual(names.OrderBy(x => x, StringComparer.OrdinalIgnoreCase), StringComparer.OrdinalIgnoreCase);
    }

    static string[] DropPaths(IntPtr drop) {
        uint count = DragQueryFileW(drop, UInt32.MaxValue, null, 0);
        if (count > 256) throw new InvalidDataException();
        var paths = new string[count];
        for (uint i = 0; i < count; i++) {
            uint length = DragQueryFileW(drop, i, null, 0);
            if (length == 0 || length > 32767) throw new InvalidDataException();
            var buffer = new StringBuilder((int)length + 1);
            if (DragQueryFileW(drop, i, buffer, length + 1) != length) throw new InvalidDataException();
            paths[i] = buffer.ToString();
        }
        return paths;
    }

    static object ReadFolders(Request request) {
        uint sequence = GetClipboardSequenceNumber();
        bool opened = false;
        string[] paths;
        try {
            for (int attempt = 0; attempt < 5 && !opened; attempt++) {
                opened = OpenClipboard(IntPtr.Zero);
                if (!opened) Thread.Sleep(20);
            }
            if (!opened) return Reply(request.requestId, "busy");
            if (sequence != GetClipboardSequenceNumber()) return Reply(request.requestId, "changed");
            IntPtr drop = GetClipboardData(15); // CF_HDROP: paths only, no folder enumeration.
            if (drop == IntPtr.Zero) return Reply(request.requestId, "empty");
            try { paths = DropPaths(drop); }
            catch (InvalidDataException) { return Reply(request.requestId, "invalid"); }
            if (paths.Length == 0) return Reply(request.requestId, "empty");
        } finally {
            if (opened) CloseClipboard();
        }
        // Never hold the clipboard lock during filesystem metadata queries.
        foreach (string path in paths) {
            uint attributes = GetFileAttributesW(path);
            if (attributes == UInt32.MaxValue) return Reply(request.requestId, "unavailable");
            if ((attributes & 16) == 0) return Reply(request.requestId, "not-folders");
        }
        paths = paths.Select(DisplayPath).ToArray();
        if (!ValidPaths(paths)) return Reply(request.requestId, "invalid");
        if (!NamesMatch(paths, request.names) || sequence != GetClipboardSequenceNumber()) return Reply(request.requestId, "changed");
        return Reply(request.requestId, "ok", paths);
    }

    static byte[] ReadExactly(Stream input, int count) {
        byte[] bytes = new byte[count];
        for (int offset = 0; offset < count;) {
            int read = input.Read(bytes, offset, count - offset);
            if (read == 0) throw new EndOfStreamException();
            offset += read;
        }
        return bytes;
    }

    // A clean EOF between frames ends the session normally; a partial header is
    // a truncated frame and therefore a protocol error.
    static bool TryReadLength(Stream input, out int length) {
        length = 0;
        byte[] header = new byte[4];
        int read = 0;
        while (read < 4) {
            int chunk = input.Read(header, read, 4 - read);
            if (chunk == 0) {
                if (read == 0) return false;
                throw new EndOfStreamException();
            }
            read += chunk;
        }
        length = BitConverter.ToInt32(header, 0);
        return true;
    }

    static byte[] Frame(string json) {
        byte[] bytes = Utf8.GetBytes(json);
        byte[] header = BitConverter.GetBytes(bytes.Length);
        var framed = new byte[4 + bytes.Length];
        Buffer.BlockCopy(header, 0, framed, 0, 4);
        Buffer.BlockCopy(bytes, 0, framed, 4, bytes.Length);
        return framed;
    }

    static string ReadFrame(Stream input) {
        int length = BitConverter.ToInt32(ReadExactly(input, 4), 0);
        return Utf8.GetString(ReadExactly(input, length));
    }

    // One long-lived session: announce readiness, then answer frames until the
    // browser closes the port (EOF). No clipboard access happens before a real
    // request arrives.
    static int Serve(Stream input, Stream output) {
        Send(output, new { version = 1, type = "ready" });
        while (true) {
            int length;
            if (!TryReadLength(input, out length)) return 0;
            if (length <= 0 || length > 1048576) return 3;
            Request request;
            try { request = Json.Deserialize<Request>(Utf8.GetString(ReadExactly(input, length))); }
            catch { return 1; }
            if (!ValidRequest(request)) {
                Send(output, Reply(null, "invalid"));
                continue;
            }
            // The deadline bounds one read, not the idle session.
            using (var deadline = new Timer(_ => Environment.Exit(4), null, 3000, Timeout.Infinite)) {
                Send(output, ReadFolders(request));
            }
        }
    }

    static void Send(Stream output, object reply) {
        byte[] bytes = Utf8.GetBytes(Json.Serialize(reply));
        byte[] length = BitConverter.GetBytes(bytes.Length);
        output.Write(length, 0, length.Length);
        output.Write(bytes, 0, bytes.Length);
        output.Flush();
    }

    static void SelfTest() {
        if (!ValidPaths(new[] { @"C:\资料\a b", @"\\server\share\目录" })
            || ValidPaths(new[] { "relative" }) || ValidPaths(new[] { "\"C:\\folder\"" })
            || ValidPaths(new[] { "C:\\bad\nline" }) || ValidPaths(new string[0])
            || DisplayPath(@"\\?\UNC\server\share\folder") != @"\\server\share\folder"
            || !NamesMatch(new[] { @"C:\one", @"D:\two" }, new[] { "two", "one" })
            || NamesMatch(new[] { @"C:\one" }, new[] { "two" })
            || !ValidRequest(new Request { version = 1, action = "readFolders", requestId = "test-1", names = new string[0] })
            || ValidRequest(new Request { version = 1, action = "write", requestId = "test", names = new string[0] }))
            throw new Exception("Self-test failed");
        // Exercise the real shell parser without changing the user's clipboard.
        var expected = new[] { @"C:\资料\a b", @"\\server\share\目录" };
        byte[] payload = Encoding.Unicode.GetBytes(String.Join("\0", expected) + "\0\0");
        IntPtr drop = Marshal.AllocHGlobal(20 + payload.Length);
        try {
            for (int i = 0; i < 20; i++) Marshal.WriteByte(drop, i, 0);
            Marshal.WriteInt32(drop, 0, 20);
            Marshal.WriteInt32(drop, 16, 1);
            Marshal.Copy(payload, 0, IntPtr.Add(drop, 20), payload.Length);
            if (!DropPaths(drop).SequenceEqual(expected)) throw new Exception("CF_HDROP parser failed");
        } finally { Marshal.FreeHGlobal(drop); }
        using (var stream = new MemoryStream()) {
            Send(stream, Reply("test", "ok", new[] { @"C:\资料" }));
            stream.Position = 0;
            int length = BitConverter.ToInt32(ReadExactly(stream, 4), 0);
            if (!Utf8.GetString(ReadExactly(stream, length)).Contains("资料")) throw new Exception("UTF-8 framing failed");
        }
        // The session loop: readiness first, one reply per frame, EOF ends it.
        // Both requests are rejected before any clipboard access, so the
        // self-test never opens the Author's clipboard.
        using (var input = new MemoryStream())
        using (var output = new MemoryStream()) {
            byte[] first = Frame(@"{""version"":1,""action"":""write"",""requestId"":""a"",""names"":[]}");
            byte[] second = Frame(@"{""version"":1,""action"":""write"",""requestId"":""b"",""names"":[]}");
            input.Write(first, 0, first.Length);
            input.Write(second, 0, second.Length);
            input.Position = 0;
            if (Serve(input, output) != 0) throw new Exception("Session did not end on EOF");
            output.Position = 0;
            if (!ReadFrame(output).Contains(@"""type"":""ready""")) throw new Exception("Ready handshake failed");
            for (int i = 0; i < 2; i++) {
                if (!ReadFrame(output).Contains(@"""status"":""invalid""")) throw new Exception("Frame not answered");
            }
            if (output.Position != output.Length) throw new Exception("Unexpected trailing output");
        }
    }

    [STAThread]
    static int Main(string[] args) {
        try {
            if (args.Length == 1 && args[0] == "--self-test") { SelfTest(); return 0; }
            if (args.Length == 0 || !Regex.IsMatch(args[0], @"\Achrome-extension://[a-p]{32}/\z")) return 2;
            using (Stream input = Console.OpenStandardInput())
            using (Stream output = Console.OpenStandardOutput()) {
                return Serve(input, output);
            }
        } catch { return 1; }
    }
}

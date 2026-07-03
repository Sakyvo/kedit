import MarkdownIt from 'markdown-it';
import frontmatterRule from '../../../../src/extensions/frontmatterRule';

function createMarkdown() {
  const markdown = new MarkdownIt();
  markdown.block.ruler.before('hr', 'frontmatter', frontmatterRule);
  markdown.renderer.rules.frontmatter = (tokens, idx) =>
    `<div class="kedit-frontmatter"><pre class="kedit-frontmatter__content">${
      markdown.utils.escapeHtml(tokens[idx].content)
    }</pre></div>\n`;
  return markdown;
}

describe('frontmatterRule', () => {
  it('renders leading YAML frontmatter as a dedicated preview block', () => {
    const html = createMarkdown().render([
      '---',
      'title: Hello',
      'tags:',
      '  - a',
      '---',
      '',
      '# Heading',
      '',
    ].join('\n'));

    expect(html).toContain('<div class="kedit-frontmatter">');
    expect(html).toContain('title: Hello');
    expect(html).toContain('<h1>Heading</h1>');
    expect(html).not.toContain('<h2>title: Hello');
  });

  it('does not consume horizontal rules outside leading frontmatter', () => {
    const html = createMarkdown().render([
      'Intro',
      '',
      '---',
      '',
      'After',
      '',
    ].join('\n'));

    expect(html).toContain('<hr>');
    expect(html).not.toContain('kedit-frontmatter');
  });

  it('escapes frontmatter content before rendering', () => {
    const html = createMarkdown().render([
      '---',
      'title: <script>alert(1)</script>',
      '---',
      '',
    ].join('\n'));

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });
});

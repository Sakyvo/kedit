// Keep the HTML shell paintable while Vite loads the application and its CSS.
import('./main').catch(() => {
  const status = document.querySelector('#startup span');
  if (status) status.textContent = 'KEDIT 加载失败，请检查网络后刷新。';
});

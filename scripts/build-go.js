'use strict';
// Node標準のみ。実行場所にかかわらず、リポジトリ内の定義から生成する。
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root,'redirects.json'),'utf8'));
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const safeURL = value => { const url = new URL(value); if (!['https:','http:'].includes(url.protocol) || url.username || url.password) throw new Error('遷移先は認証情報を含まないHTTP(S)絶対URLにしてください。'); return url; };
const marker = '<!-- build-go.js による生成ファイル。編集は redirects.json で行う。 -->';
const head = title => `<!doctype html>\n${marker}\n<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${escape(title)}</title>`;
const style = '<style>body{font:16px/1.6 system-ui,sans-serif;max-width:1000px;margin:32px auto;padding:0 20px;color:#19372e}a{color:#185744;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;table-layout:fixed}td,th{border:1px solid #ccd8cf;text-align:left;padding:12px;overflow-wrap:anywhere}th:first-child{width:22%}.scroll{overflow-x:auto}code{overflow-wrap:anywhere}</style>';
// 全定義を先に検証。誤った定義では生成済みページを変更しない。
const entries = Object.entries(config.links).map(([slug,link]) => {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug) || slug === 'index') throw new Error('slug は index 以外の小文字英数字・ハイフンにしてください。');
  const url = safeURL(link.to === 'base' ? config.base : link.to === 'form' ? config.form : link.to);
  for (const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term']) {
    if (link[key] !== undefined) {
      if (typeof link[key] !== 'string' || !/^[a-z0-9_-]+$/.test(link[key])) throw new Error(slug + ': UTMは小文字英数字・ハイフン・アンダースコアで指定してください。');
      url.searchParams.set(key,link[key]);
    }
  }
  const short = new URL('go/'+slug+'.html',safeURL(config.form)).href;
  return {slug,url:url.href,short};
});
const output = path.join(root,'go'); fs.mkdirSync(output,{recursive:true});
for (const {slug,url} of entries) {
  const scriptURL = JSON.stringify(url).replace(/</g,'\\u003c');
  fs.writeFileSync(path.join(output,slug+'.html'),head('CCJページへ移動します') + `<meta http-equiv="refresh" content="0;url=${escape(url)}">${style}</head><body><p>CCJのページへ移動します。</p><p><a href="${escape(url)}">移動しない場合はこちら</a></p><noscript><p><a href="${escape(url)}">CCJのページを開く</a></p></noscript><script>location.replace(${scriptURL});</script></body></html>\n`);
}
const rows = entries.map(({slug,url,short}) => `<tr><th scope="row">${escape(slug)}</th><td><a href="${escape(short)}">${escape(short)}</a></td><td><a href="${escape(url)}">${escape(url)}</a></td></tr>`).join('\n');
fs.writeFileSync(path.join(output,'index.html'),head('CCJ QR・リンク一覧')+style+`</head><body><h1>QR・リンク一覧</h1><p>QRには中央列の短縮URLを使います。最終URLは右列で確認できます。</p><p>sample-event は見本です。配布前に実際のイベント名へ変更してください。ig はホームページへ移動します。別ドメインを経由したUTMはフォームへ自動継承されません。</p><div class="scroll"><table><thead><tr><th>slug</th><th>QR用URL</th><th>最終URL</th></tr></thead><tbody>${rows}</tbody></table></div></body></html>\n`);
// 定義から消えた自動生成ページのみ削除。手書きファイルには触らない。
for (const file of fs.readdirSync(output)) {
  if (!file.endsWith('.html') || file === 'index.html' || entries.some(e => file === e.slug+'.html')) continue;
  const target = path.join(output,file);
  if (fs.readFileSync(target,'utf8').includes(marker)) fs.unlinkSync(target);
}
console.log(`${entries.length}件のリダイレクトと一覧を生成しました。`);

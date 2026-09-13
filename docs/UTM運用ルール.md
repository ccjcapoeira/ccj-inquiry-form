# UTM・QR運用ルール

## 命名と初期リンク

すべて小文字・半角。コード上は英数字とハイフン・アンダースコアを使用します。`utm_source` は媒体、`utm_medium` は性質、`utm_campaign` は施策名（年月や場所）、`utm_content` は素材・設置面、`utm_term` は検索語等です。個人名・メールはURLへ入れません。

| 置き場所 | source | medium | campaign例 |
|---|---|---|---|
| Instagramプロフィール | instagram | social | profile |
| Instagram広告 | instagram | paid | ad2026-10 |
| Googleビジネスプロフィール | google | gbp | minoh / senri / kobe / nishinomiya / abeno / esaka / itami |
| 地域イベントQR | event | qr | sakurai2026-08 |
| チラシQR | flyer | qr | minoh2026-10 |
| ポスター | poster | qr | senri |
| YouTube | youtube | social | channel |
| LINE公式 | line | referral | member-share |

QR用URLは公開後に使えます。`ig-ad` の10月施策と `sample-event` は仮置きなので、配布前に実際の施策名へ変更します。

| slug | QR・設置用URL | UTM付き最終URL |
|---|---|---|
| ig | `https://ccjcapoeira.github.io/ccj-inquiry-form/go/ig.html` | [遷移先](https://cordao.org/?utm_source=instagram&utm_medium=social&utm_campaign=profile) |
| ig-ad | `https://ccjcapoeira.github.io/ccj-inquiry-form/go/ig-ad.html` | [遷移先](https://ccjcapoeira.github.io/ccj-inquiry-form/?utm_source=instagram&utm_medium=paid&utm_campaign=ad2026-10) |
| gbp-minoh | `https://ccjcapoeira.github.io/ccj-inquiry-form/go/gbp-minoh.html` | [遷移先](https://ccjcapoeira.github.io/ccj-inquiry-form/?utm_source=google&utm_medium=gbp&utm_campaign=minoh) |
| gbp-senri | `https://ccjcapoeira.github.io/ccj-inquiry-form/go/gbp-senri.html` | [遷移先](https://ccjcapoeira.github.io/ccj-inquiry-form/?utm_source=google&utm_medium=gbp&utm_campaign=senri) |
| gbp-kobe | `https://ccjcapoeira.github.io/ccj-inquiry-form/go/gbp-kobe.html` | [遷移先](https://ccjcapoeira.github.io/ccj-inquiry-form/?utm_source=google&utm_medium=gbp&utm_campaign=kobe) |
| gbp-nishinomiya | `https://ccjcapoeira.github.io/ccj-inquiry-form/go/gbp-nishinomiya.html` | [遷移先](https://ccjcapoeira.github.io/ccj-inquiry-form/?utm_source=google&utm_medium=gbp&utm_campaign=nishinomiya) |
| gbp-abeno | `https://ccjcapoeira.github.io/ccj-inquiry-form/go/gbp-abeno.html` | [遷移先](https://ccjcapoeira.github.io/ccj-inquiry-form/?utm_source=google&utm_medium=gbp&utm_campaign=abeno) |
| gbp-esaka | `https://ccjcapoeira.github.io/ccj-inquiry-form/go/gbp-esaka.html` | [遷移先](https://ccjcapoeira.github.io/ccj-inquiry-form/?utm_source=google&utm_medium=gbp&utm_campaign=esaka) |
| gbp-itami | `https://ccjcapoeira.github.io/ccj-inquiry-form/go/gbp-itami.html` | [遷移先](https://ccjcapoeira.github.io/ccj-inquiry-form/?utm_source=google&utm_medium=gbp&utm_campaign=itami) |
| yt | `https://ccjcapoeira.github.io/ccj-inquiry-form/go/yt.html` | [遷移先](https://ccjcapoeira.github.io/ccj-inquiry-form/?utm_source=youtube&utm_medium=social&utm_campaign=channel) |
| line | `https://ccjcapoeira.github.io/ccj-inquiry-form/go/line.html` | [遷移先](https://ccjcapoeira.github.io/ccj-inquiry-form/?utm_source=line&utm_medium=referral&utm_campaign=member-share) |
| sample-event | `https://ccjcapoeira.github.io/ccj-inquiry-form/go/sample-event.html` | [遷移先](https://ccjcapoeira.github.io/ccj-inquiry-form/?utm_source=event&utm_medium=qr&utm_campaign=sample-event) |

## 初回情報とUTMの保存

- フォームを開いたときの初回URL・参照元を `localStorage` の `ccj_attribution` に保存します。次回以降も初回URL・参照元は保持します。
- URLに値のあるUTMが1つでも来たら、その訪問の5つのUTMを一式で更新します。指定されなかったUTMは空欄にし、以前のキャンペーンと混ぜません。UTMが全部空なら以前の保存値を使用します。
- 指示書の「値があれば保存」を優先した仕様であり、UTMは厳密な初回固定ではなく **最後に明示されたキャンペーン** です。本人申告の「最初の接点」とは区別します。
- ストレージへのアクセス・保存ができない場合は、UTMと初回URL・初回参照元を空文字にして受付を続けます。現在の参照元・送信URL・端末・送信日時は通常どおり取得します。
- 入力した氏名やメール等はlocalStorageに保存しません。保持期限は未指定のため自動期限なしです。ブラウザのデータ削除・別端末・別ブラウザ・プライベートモードでは継続できません。

## Goopeを経由する際の制限

`ig` は指示書の例どおり `https://cordao.org/` へ移動します。**GoopeとGitHub Pagesは別ドメインなので、Goopeから通常リンクでフォームに来ても、InstagramのUTMは自動継承されません。** 参照元もブラウザの仕様によりドメインだけになる、または空になる場合があります。

問い合わせの媒体別計測を優先する場合は `redirects.json` の `ig.to` を `form` にして再生成します。初期設定では他の11件を `form` にしています。この実装はGoopeへの転送スクリプト追加や書き換えを行いません。

## リンクを追加・変更する

1. `redirects.json` の `links` に新しい項目を追加します。slugは `index` 以外の小文字英数字・ハイフン。`to` は `base`（ホームページ）/ `form`（新フォーム）/ HTTP(S)絶対URLです。
2. 例としてイベントを追加する場合は次の項目を使います。実際の会場・年月に置き換えます。

   ```json
   "sakurai2026-08": {
     "to": "form",
     "utm_source": "event",
     "utm_medium": "qr",
     "utm_campaign": "sakurai2026-08"
   }
   ```

3. ターミナルで `cd ~/GitHub/ccj-inquiry-form` → `node scripts/build-go.js` を実行します。Node標準のみで動作し、npm installは不要です。
4. `go/index.html` に出る一覧で最終URLを確認し、`redirects.json` と `go/` を一緒にコミット・pushします。生成HTMLを直接修正しません。
5. 配布済みのslugは削除・改名しません。行き先を変える場合も既存のQRが新しい行き先へ変わることを確認して更新します。定義から削除した自動生成ページは再生成時に消えます。

## QRを作る

1. 公開済みの `go/index.html` を開き、目的のslugの **QR用URL**（`.../go/slug.html`）をコピーします。末尾の `.html` も必要です。
2. 使用中のQR作成ツールで「URL」を選び、コピーしたURLを貼り付けます。追跡サービスへの置き換えを伴わない通常の静的QRで保存します。
3. 印刷原寸で周囲の白い余白を確保し、iPhone/Androidから読み取って正しいページに着くことを確認します。
4. 新フォームへ向くリンクは、移動後のURLに意図したUTMがあることと、実送信の台帳にそのUTMが入ることを確認して配布します。

リダイレクトはJavaScriptとmeta refreshの両方を備え、JavaScript無効時にもリンクを表示します。アクセス数そのものの計測やQR画像の作成は、このリポジトリの機能には含みません。

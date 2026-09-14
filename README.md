# CCJ 問い合わせフォーム・リード台帳

新規の見学・体験・その他問い合わせを、1件＝Googleスプレッドシート1行として記録します。フォームは外部ライブラリ・ビルド不要のHTML/CSS/JS、受信はGoogle Apps Scriptです。本人申告の認知経路とUTM・参照元を別々に保存します。

- [公開フォーム](https://ccjcapoeira.github.io/ccj-inquiry-form/) （公開済み）
- 既存サイト: https://cordao.org/ （問い合わせリンクを新フォームへ直結、旧ページは自動転送）
- 関連リポジトリ: `~/GitHub/ccj-enrollment-form` （入会フォーム。参照のみ）
- 作業場所: `~/GitHub/ccj-inquiry-form`
- 通知先: `ccj.osaka@gmail.com`

## 現在のセットアップ

2026-09-13、ユーザーの追加依頼によりCodexが自動設定を実施。Google承認、CCJ所有の台帳、GAS配置・デプロイ、送信先設定、GitHub Pages公開が完了しました。公開フォームからの実送信で台帳1行と自動返信・管理通知の2通を確認済みです。Goopeの問い合わせリンクを新フォームへ直結し、旧お問い合わせページは自動転送に変更済みです。本人用の進行手順はローカルの `.local/本人が行う操作.md` に保存しています。

## 最初に行うこと（別環境の新規設定用）

[セットアップ手順](docs/セットアップ手順.md)に従い、スプレッドシートを作成→GASを貼付→`setupInquiry` を実行→ウェブアプリをデプロイ→`index.html` の **`const SCRIPT_URL = '';`** に新しい `/exec` URLを設定→GitHubへpushしてPagesを公開します。Goopeのリンク設置・実送信確認まで行います。

URL空欄では送信をスキップするプレビューです。画面にその旨を表示し、個人情報をコンソールには出しません。確認画面で送信すると完了画面まで試せます。`no-cors` のため実運用でも完了画面だけではGAS保存成功を確認できず、台帳・メールで確認が必要です。

## ファイル

| ファイル | 内容 |
|---|---|
| `index.html` | 入力→確認→送信→完了、条件付き年齢欄、UTM保持 |
| `google-apps-script.js` | 台帳初期化、入力検証、採番・保存、自動返信・管理通知 |
| `redirects.json` | QR用slugとUTM・行き先の定義 |
| `scripts/build-go.js` | Node標準だけでQR転送ページを生成 |
| `go/index.html` | QR用URLと最終URLの一覧 |
| `go/*.html` | 12個の転送ページ。meta refreshとJSを併用 |
| `docs/セットアップ手順.md` | 非エンジニア向け公開・テスト手順 |
| `docs/UTM運用ルール.md` | 媒体別URL・命名・QR運用・計測の制限 |
| `docs/台帳運用.md` | 先生の6列更新・ステータスの意味 |
| `docs/LookerStudio手順.md` | 接続、5ページの分析、転換率の式 |
| `verification/` | 検証スクリプト・結果・個人情報を含まない表示画像 |

## ペイロードと32列の対応

外側は `{ formType: 'inquiry', payload: { ... } }`。自動取得情報は画面に表示せずJSONにのみ含めます（hidden相当）。全項目の対応は以下です。

| payloadのキー | 台帳ヘッダー（この順） | 保存方法 |
|---|---|---|
| —（GAS生成） | ID | 受付日のJST + 同日件数から採番、ロックで保護 |
| submittedAt | 受付日時 | ISO→日付型、JST表示 |
| name | 氏名 | 文字列 |
| email | メール | 文字列 |
| tel | 電話 | 先頭ゼロを保つ文字列 |
| classType | クラス | 日本語ラベル |
| dojo | 教室 | 選択した日本語 |
| requestType | 種別 | 日本語ラベル |
| childAge | 子の年齢 | キッズのみ。0も保存 |
| firstTouch | 最初の接点 | 日本語ラベル |
| firstTouchOther | 最初の接点(その他) | その他のみ |
| referrerName | 紹介者 | 紹介系のみ |
| preContact | 直前に見たもの | HTML名 preContact[]、JSON配列→「、」連結 |
| searchWords | 検索語 | 文字列 |
| message | メッセージ | 文字列 |
| utm_source | utm_source | 文字列 |
| utm_medium | utm_medium | 文字列 |
| utm_campaign | utm_campaign | 文字列 |
| utm_content | utm_content | 文字列 |
| utm_term | utm_term | 文字列 |
| firstLandingPage | 初回LP | 保存した初回URL |
| firstReferrer | 初回参照元 | 保存した初回参照元 |
| currentReferrer | 送信時参照元 | 送信時の参照元 |
| submitPage | 送信ページ | 送信時のURL |
| deviceType | 端末 | mobile / tablet / desktop |
| —（GAS初期値） | ステータス | 問合せ |
| —（手動更新） | 体験日 | 初期値は空欄 |
| —（手動更新） | 入会日 | 初期値は空欄 |
| —（手動更新） | 入会理由 | 初期値は空欄 |
| —（手動更新） | 見送り理由 | 初期値は空欄 |
| —（手動更新） | 担当 | 初期値は空欄 |
| —（手動更新） | メモ | 初期値は空欄 |

### 指示書の「全キーと列が1対1」の例外

指定された32列には次の専用列がありません。**32列の名前・順序を優先したため、厳密な1対1にはできません。** 台帳に列を勝手に追加せず、以下の扱いとしました。

| 送信キー | 扱い |
|---|---|
| `privacyAgree` | 必須同意をGASで検証。trueでないと保存しない。同意証跡としての独立列はない |
| `userAgent` | ブラウザでdeviceTypeを算出する元情報。送信するが台帳には原文保存しない |
| 外側の `formType` | inquiryだけを受け付けるための振り分け。台帳には保存しない |

IDと運用7列は送信データにないGAS生成・手動更新項目です。`submittedAt` は受付日時に日付型で保存します。列名が一致しない既存台帳へは書き込みを止め、誤った列への混入を防ぎます。

## 仮置き・判断

- お子様の年齢は満0〜18歳の整数。実際の対象年齢を意味するものではありません。
- 電話番号はメールの直後に常時表示して必須入力。任意の事前接触・検索語・メッセージをまとめて折りたたみ、スマホで必須入力を短くしました。
- UTMは新しい値が来ればキャンペーン一式を更新。初回LP・参照元は固定。ストレージ不可時はUTMと初回情報を空文字にします。
- `ig` は指示書の例どおりGoopeへ、他11件は新フォームへ直接遷移。Goopeを経由したUTMはフォームへ自動継承されません。
- 広告キャンペーン `ad2026-10` とイベント `sample-event` は配布前に確定してください。
- 公式Instagramは既存公開サイトの保存HTMLで確認した `https://www.instagram.com/ccj.capoeira_osaka/` を使用。
- Webアプリ実行時に確実に台帳を開けるよう、初回 `setupInquiry` でIDをGASのプロパティに登録します。IDを推測・コードへ埋め込みません。
- メール失敗時も台帳行は残り、実行ログにIDと失敗したメール種別を出します。再送は自動化していません。同時送信のID重複と送信中の連打は防ぎますが、再読み込み・別タブ・通信エラー後の再送による重複までは排除しません。

## ローカル確認

```bash
cd ~/GitHub/ccj-inquiry-form
node scripts/build-go.js
node --check google-apps-script.js
node verification/gas-test.cjs
python3 -m http.server 8765 --bind 127.0.0.1
```

現在の `index.html` は本番のGASへ送信します。送信を伴うローカル検証には、送信先を空にしたコピー、または下記の模擬送信による回帰検証を使ってください。ブラウザで `http://127.0.0.1:8765/` を開きます。UTM保持の確認は `?utm_source=test&utm_medium=qr&utm_campaign=x` を付けて開き、その後クエリを消して開き直します。保存される値は開発者ツールのlocalStorageから確認できます。

ブラウザ回帰検証は開発環境側のPlaywrightを使った `verification/browser-test.cjs` です。フォーム本体の依存ではありません。実行方法と結果は [検証記録](verification/結果.md) に記載します。GAS固有APIはローカルの模擬APIで検証し、本番の実送信も確認済みです。回帰検証スクリプトは本番URLを空欄に置換したHTMLを配信し、外部へ実送信しません。

## 更新履歴

- 2026-09-13: 問い合わせフォーム・32列台帳GAS・12件のQR転送ページ・4種の手順書を新規作成。ローカル検証を実施。公開・GASデプロイ・メール実送信は未実施。

- 2026-09-13（公開工程）: 追加依頼に基づきGASとGitHub Pagesを公開。台帳保存・UTM・2通のメール受信を確認。検証行に集計除外メモを記入。

// CCJ 問い合わせ専用。スプレッドシートの「拡張機能 → Apps Script」に貼り付ける。
// 初回は setupInquiry をエディタから実行し、紐づくシートを記録・権限を許可する。
// IDやデプロイURLはこのファイルに書かない。
var OWNER_EMAIL_OVERRIDE_ = 'ccj.osaka@gmail.com';
var HEADERS_ = ["ID", "受付日時", "氏名", "メール", "電話", "クラス", "教室", "種別", "子の年齢", "最初の接点", "最初の接点(その他)", "紹介者", "直前に見たもの", "検索語", "メッセージ", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "初回LP", "初回参照元", "送信時参照元", "送信ページ", "端末", "ステータス", "体験日", "入会日", "入会理由", "見送り理由", "担当", "メモ"];
var CLASS_LABELS_ = {"kids": "キッズ", "adult": "大人", "undecided": "親子・未定"};
var REQUEST_LABELS_ = {"visit": "見学", "trial": "体験", "other": "その他（取材・イベント等）"};
var FIRST_TOUCH_LABELS_ = {"instagram": "Instagram（投稿・リール）", "instagram_ad": "Instagram広告", "google_search": "Google検索", "google_maps": "Googleマップ", "youtube": "YouTube", "other_sns": "TikTok・Facebook など", "referral_friend": "家族・友人からの紹介", "referral_member": "通っている生徒・保護者からの紹介", "event": "地域のイベント・お祭りで見た", "flyer": "チラシ・ポスター", "school": "学校・幼稚園・保育園で知った", "other_group": "他のカポエイラ団体", "known": "以前から知っていた", "other": "その他"};
var DOJOS_ = ["箕面", "千里", "神戸", "西宮", "阿倍野", "江坂", "伊丹", "未定"];
var PRE_CONTACT_ = ["Google検索", "Googleマップ", "Instagram", "ホームページ", "YouTube", "チラシ・ポスター", "イベント", "知人の話"];
var STATUSES_ = ['問合せ','日程調整中','体験済','入会','見送り','連絡途絶'];

function setupInquiry() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('スプレッドシートの拡張機能から開いて実行してください。');
  PropertiesService.getScriptProperties().setProperty('INQUIRY_SPREADSHEET_ID', ss.getId());
  ss.setSpreadsheetTimeZone('Asia/Tokyo');
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { ensureSheet_(ss); SpreadsheetApp.flush(); } finally { lock.releaseLock(); }
  // デプロイ前にメール送信の権限も許可する。メール自体は送信しない。
  MailApp.getRemainingDailyQuota();
  console.log('問い合わせ台帳の準備が完了しました。');
}
function doGet() { return json_({result:'ready',message:'CCJ 問い合わせAPI'}); }
function doPost(e) {
  try {
    if (!e || !e.postData || e.postData.contents.length > 40000) throw new Error('送信データが不正です。');
    var raw = JSON.parse(e.postData.contents);
    if (!raw || raw.formType !== 'inquiry') throw new Error('対応していないフォームです。');
    var id = PropertiesService.getScriptProperties().getProperty('INQUIRY_SPREADSHEET_ID');
    if (!id) throw new Error('setupInquiry を実行してください。');
    var ss = SpreadsheetApp.openById(id);
    var inquiryId = handleInquiry_(ss, raw);
    return json_({result:'success',id:inquiryId});
  } catch (error) {
    // ペイロード・氏名・アドレスを実行ログへ出さない。
    console.log('問い合わせ処理エラー: ' + error.message);
    return json_({result:'error',message:error.message});
  }
}
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function text_(value, max) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new Error('文字列項目が不正です。');
  if (value.length > max) throw new Error('入力文字数を超えています。');
  return value.trim();
}
function label_(map, value) {
  if (!Object.prototype.hasOwnProperty.call(map, value)) throw new Error('選択項目が不正です。');
  return map[value];
}
function validate_(raw) {
  var p = raw.payload;
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('入力内容がありません。');
  var clean = {};
  var limits = {name:100,email:254,tel:30,dojo:30,childAge:2,firstTouchOther:300,referrerName:100,searchWords:300,message:3000,
    utm_source:1000,utm_medium:1000,utm_campaign:1000,utm_content:1000,utm_term:1000,firstLandingPage:4000,firstReferrer:4000,currentReferrer:4000,submitPage:4000,userAgent:2000,deviceType:20,submittedAt:40};
  Object.keys(limits).forEach(function(key) { clean[key] = text_(p[key],limits[key]); });
  if (!clean.name || /[\r\n]/.test(clean.name) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) throw new Error('お名前・メールを確認してください。');
  clean.classLabel = label_(CLASS_LABELS_, p.classType);
  clean.requestLabel = label_(REQUEST_LABELS_, p.requestType);
  clean.firstTouchLabel = label_(FIRST_TOUCH_LABELS_, p.firstTouch);
  if (DOJOS_.indexOf(clean.dojo) < 0 || p.privacyAgree !== true) throw new Error('教室・同意を確認してください。');
  if (p.classType === 'kids') {
    if (!/^\d{1,2}$/.test(clean.childAge) || Number(clean.childAge) > 18) throw new Error('お子様の年齢を確認してください。');
  } else { clean.childAge = ''; }
  if (p.firstTouch !== 'other') clean.firstTouchOther = '';
  if (['referral_friend','referral_member'].indexOf(p.firstTouch) < 0) clean.referrerName = '';
  if (!Array.isArray(p.preContact) || p.preContact.length > PRE_CONTACT_.length || p.preContact.some(function(x) { return PRE_CONTACT_.indexOf(x) < 0; })) throw new Error('直前に見たものが不正です。');
  clean.preContact = p.preContact.filter(function(x,i,a) {return a.indexOf(x) === i;}).join('、');
  if (['mobile','tablet','desktop'].indexOf(clean.deviceType) < 0) throw new Error('端末情報が不正です。');
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(clean.submittedAt) || isNaN(new Date(clean.submittedAt).getTime())) throw new Error('送信日時が不正です。');
  return clean;
}
function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0) { sheet.getRange(1,1,1,HEADERS_.length).setValues([HEADERS_]); return; }
  var actual = sheet.getRange(1,1,1,Math.max(sheet.getLastColumn(),HEADERS_.length)).getValues()[0];
  if (actual.length !== HEADERS_.length || HEADERS_.some(function(v,i) {return actual[i] !== v;})) throw new Error('台帳のヘッダーが仕様と異なります。列の順番と名前を戻してください。');
}
function ensureSheet_(ss) {
  var sheet = ss.getSheetByName('リード台帳');
  var fresh = !sheet || sheet.getLastRow() === 0;
  if (!sheet) sheet = ss.insertSheet('リード台帳');
  if (sheet.getMaxColumns() < HEADERS_.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), HEADERS_.length - sheet.getMaxColumns());
  ensureHeaders_(sheet);
  if (fresh) {
    if (sheet.getMaxRows() < 2) sheet.insertRowsAfter(1,1);
    sheet.setFrozenRows(1);
    sheet.getRange(1,1,1,HEADERS_.length).setFontWeight('bold').setBackground('#e5efe8');
    sheet.getRange(2,26,sheet.getMaxRows()-1,1).setDataValidation(statusRule_());
    sheet.getRange(2,27,sheet.getMaxRows()-1,2).setNumberFormat('yyyy/mm/dd');
  }
  return sheet;
}
function statusRule_() { return SpreadsheetApp.newDataValidation().requireValueInList(STATUSES_,true).setAllowInvalid(false).build(); }
// 自由入力を数式として実行させない。先頭ゼロの電話番号も文字列で保持する。
function sheetText_(value) { return typeof value === 'string' && /^[=+\-@\t\r\n]/.test(value) ? "'" + value : value; }
function handleInquiry_(ss, raw) {
  var p = validate_(raw), id;
  // 同時送信による同日IDの重複を避けるため、採番から書込みまでロックする。
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var sheet = ensureSheet_(ss);
    var prefix = 'INQ-' + Utilities.formatDate(new Date(),'Asia/Tokyo','yyyyMMdd') + '-';
    var ids = sheet.getLastRow() > 1 ? sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues().map(function(row){return String(row[0]);}) : [];
    var today = ids.filter(function(value) {return value.indexOf(prefix) === 0;});
    var number = today.length + 1;
    // 行の削除があっても既存IDとは衝突させない。
    while (number <= 999 && ids.indexOf(prefix + ('000' + number).slice(-3)) >= 0) number++;
    if (number > 999) throw new Error('同日の受付件数が上限に達しました。');
    id = prefix + ('000' + number).slice(-3);
    var row = [id,new Date(p.submittedAt),p.name,p.email,p.tel,p.classLabel,p.dojo,p.requestLabel,p.childAge,
      p.firstTouchLabel,p.firstTouchOther,p.referrerName,p.preContact,p.searchWords,p.message,
      p.utm_source,p.utm_medium,p.utm_campaign,p.utm_content,p.utm_term,p.firstLandingPage,p.firstReferrer,p.currentReferrer,p.submitPage,p.deviceType,
      '問合せ','','','','','',''];
    var next = sheet.getLastRow()+1;
    if (next > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(),1);
    sheet.getRange(next,1,1,HEADERS_.length).setNumberFormat('@');
    sheet.getRange(next,1,1,HEADERS_.length).setValues([row.map(sheetText_)]);
    sheet.getRange(next,2).setNumberFormat('yyyy/mm/dd hh:mm:ss');
    sheet.getRange(next,27,1,2).setNumberFormat('yyyy/mm/dd');
    sheet.getRange(next,26).setDataValidation(statusRule_());
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
  // 保存後にメール送信。一方が失敗してももう一方は試し、同じ問い合わせを再追記しない。
  var mailErrors = [];
  var summary = '受付ID: ' + id + '\n氏名: ' + p.name + '\n希望クラス: ' + p.classLabel + '\n希望教室: ' + p.dojo + '\nご希望: ' + p.requestLabel;
  var signature = '\n\nCCJ.CAPOEIRA OSAKA\n窪山\nccj.osaka@gmail.com\nTEL: 050-3636-3410';
  try {
    MailApp.sendEmail({to:p.email,subject:'【CCJカポエイラ】お問い合わせを受け付けました',replyTo:OWNER_EMAIL_OVERRIDE_,name:'CCJカポエイラ',
      body:p.name + ' 様\n\nお問い合わせありがとうございます。\n' + summary + '\n\n2営業日以内に担当者から返信します。体験日時は担当者との調整後に確定します。' + signature});
  } catch (_) { mailErrors.push('自動返信'); }
  try {
    MailApp.sendEmail({to:OWNER_EMAIL_OVERRIDE_,subject:'【新規問い合わせ】' + p.classLabel + '/' + p.dojo + '/' + p.requestLabel + ' ' + p.name,replyTo:p.email,name:'CCJ問い合わせフォーム',
      body:summary + '\n受付日時: ' + Utilities.formatDate(new Date(p.submittedAt),'Asia/Tokyo','yyyy/MM/dd HH:mm:ss') + '\nメール: ' + p.email + '\n電話: ' + p.tel + '\n子の年齢: ' + p.childAge + '\n最初の接点: ' + p.firstTouchLabel + '\nその他: ' + p.firstTouchOther + '\n紹介者: ' + p.referrerName + '\n直前に見たもの: ' + p.preContact + '\n検索語: ' + p.searchWords + '\nメッセージ: ' + p.message + '\n\n' + ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','firstLandingPage','firstReferrer','currentReferrer','submitPage','deviceType'].map(function(key){return key + ': ' + p[key];}).join('\n') + '\n\n台帳: ' + ss.getUrl()});
  } catch (_) { mailErrors.push('管理通知'); }
  if (mailErrors.length) throw new Error('台帳保存済み (' + id + ')。メール失敗: ' + mailErrors.join('・') + '。再送信せず台帳を確認してください。');
  console.log('問い合わせ保存・通知完了: ' + id);
  return id;
}

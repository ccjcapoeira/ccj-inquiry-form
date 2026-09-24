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
function doGet() {
  var configured = Boolean(PropertiesService.getScriptProperties().getProperty('INQUIRY_SPREADSHEET_ID'));
  return json_({result:configured ? 'ready' : 'setup_required',message:'CCJ 問い合わせAPI'});
}
function doPost(e) {
  var raw;
  try {
    if (!e || !e.postData || e.postData.contents.length > 40000) throw new Error('送信データが不正です。');
    raw = JSON.parse(e.postData.contents);
    if (!raw || raw.formType !== 'inquiry') throw new Error('対応していないフォームです。');
    var id = PropertiesService.getScriptProperties().getProperty('INQUIRY_SPREADSHEET_ID');
    if (!id) throw new Error('setupInquiry を実行してください。');
    var ss = SpreadsheetApp.openById(id);
    var inquiryId = handleInquiry_(ss, raw);
    return json_({result:'success',id:inquiryId});
  } catch (error) {
    notifyIssue_(error.message, raw);
    return json_({result:'error',message:error.message});
  }
}
// 通知には手動返信に必要な項目だけ含める。未検証の入力でも通知処理を止めない。
function notifyIssue_(message, raw) {
  var p = raw && raw.payload && typeof raw.payload === 'object' ? raw.payload : {};
  function field(key) { return typeof p[key] === 'string' ? p[key].replace(/[\r\n\x00-\x1f]/g,' ').trim().slice(0,300) : '（取得できませんでした）'; }
  try {
    MailApp.sendEmail({to:OWNER_EMAIL_OVERRIDE_,subject:'【問い合わせ処理エラー】',name:'CCJ問い合わせフォーム',
      body:'処理内容: ' + String(message).slice(0,2000) + '\n\n受信した連絡先（未検証の入力）\n氏名: ' + field('name') + '\nメール: ' + field('email') + '\n電話: ' + field('tel') + '\n希望教室: ' + field('dojo') + '\n\n台帳を確認し、保存されていない場合は上記連絡先へ手動で対応してください。'});
  } catch (_) {
    // 連絡先やペイロードをログへ出さない。通知失敗を再帰的に通知しない。
    console.log('問い合わせ処理エラー通知の送信に失敗: ' + String(message).slice(0,2000));
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
  if (!clean.tel) throw new Error('電話番号を入力してください。');
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
  var actual = sheet.getRange(1,1,1,HEADERS_.length).getValues()[0];
  return HEADERS_.some(function(v,i) {return actual[i] !== v;});
}
function ensureSheet_(ss, warnings) {
  var sheet = ss.getSheetByName('リード台帳');
  var fresh = !sheet || sheet.getLastRow() === 0;
  if (!sheet) sheet = ss.insertSheet('リード台帳');
  if (sheet.getMaxColumns() < HEADERS_.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), HEADERS_.length - sheet.getMaxColumns());
  if (ensureHeaders_(sheet) && warnings) warnings.push('ヘッダーが変わっています。列名に関係なく指定の1〜32列の位置へ保存しました。列順を確認し、1行目の名前を元に戻してください。列の追加は33列目以降にしてください。');
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
  var p = validate_(raw), id, warnings = [];
  // 同時送信による同日IDの重複を避けるため、採番から書込みまでロックする。
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var sheet = ensureSheet_(ss, warnings);
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
  if (warnings.length) notifyIssue_('台帳保存済み (' + id + ')。' + warnings.join(' '), raw);
  if (mailErrors.length) throw new Error('台帳保存済み (' + id + ')。メール失敗: ' + mailErrors.join('・') + '。再送信せず台帳を確認してください。');
  console.log('問い合わせ保存・通知完了: ' + id);
  return id;
}

// ============================================================
// 台帳の自動記入（証拠ベース）— 2026-09-24 追加
// 毎朝トリガーで実行。空欄のセルだけを埋め、既存の値は上書きしない。
//   入会日: 入会申込シート（メールアドレス一致）の「入会申込日」
//   体験日: 送信済みメール「◯月◯日 …体験のお礼」の件名の日付（無ければ送信日の前日）
// 根拠は「自動更新ログ」シートに残す。変更があった日は管理者へ要約メール。
// ============================================================
var LEDGER_COL_ = {name:3, email:4, dojo:7, status:26, trialDate:27, joinDate:28, memo:32, received:2};
var AUTO_LOG_SHEET_ = '自動更新ログ';
var ENROLL_SHEET_NAME_ = '入会';

// 初回に1回だけ手動実行: 入会申込シートのIDを保存する（URLの /d/ と /edit の間の文字列）
function setEnrollmentSpreadsheetId(id) {
  if (!id) throw new Error('setEnrollmentSpreadsheetId("スプレッドシートID") の形で実行してください。');
  PropertiesService.getScriptProperties().setProperty('ENROLLMENT_SPREADSHEET_ID', String(id).trim());
  SpreadsheetApp.openById(String(id).trim()).getSheetByName(ENROLL_SHEET_NAME_); // 権限とシート名の確認
  console.log('入会申込シートIDを保存しました。');
}
// 初回に1回だけ手動実行: 毎朝7時台に自動実行するトリガーを登録（重複登録しない）
function installLedgerAutoSyncTrigger() {
  var exists = ScriptApp.getProjectTriggers().some(function(t){ return t.getHandlerFunction() === 'syncLedgerEvidence'; });
  if (exists) { console.log('トリガーは登録済みです。'); return; }
  ScriptApp.newTrigger('syncLedgerEvidence').timeBased().everyDays(1).atHour(7).inTimezone('Asia/Tokyo').create();
  console.log('毎朝7時台の自動記入トリガーを登録しました。');
}
// 書き込まずに「何が埋まるか」だけログに出す（初回確認用）
function syncLedgerEvidenceDryRun() { syncLedgerEvidence_(true); }
// 本番（トリガーから呼ばれる）
function syncLedgerEvidence() { syncLedgerEvidence_(false); }

function syncLedgerEvidence_(dryRun) {
  var ledgerId = PropertiesService.getScriptProperties().getProperty('INQUIRY_SPREADSHEET_ID');
  var enrollId = PropertiesService.getScriptProperties().getProperty('ENROLLMENT_SPREADSHEET_ID');
  if (!ledgerId) throw new Error('setupInquiry が未実行です。');
  var ss = SpreadsheetApp.openById(ledgerId);
  var sheet = ss.getSheetByName('リード台帳');
  if (!sheet || sheet.getLastRow() < 2) { console.log('台帳に行がありません。'); return; }
  var enrollIndex = enrollId ? buildEnrollmentIndex_(enrollId) : null;
  if (!enrollId) console.log('ENROLLMENT_SPREADSHEET_ID 未設定のため入会日は照合しません。');

  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  var changes = [];
  try {
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS_.length).getValues();
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], rowNo = i + 2;
      var id = String(r[0] || ''), email = String(r[LEDGER_COL_.email - 1] || '').trim().toLowerCase();
      var memo = String(r[LEDGER_COL_.memo - 1] || ''), status = String(r[LEDGER_COL_.status - 1] || '');
      if (!id || !email || /集計対象外|動作確認/.test(memo)) continue;
      if (status === '見送り' || status === '連絡途絶') continue;
      var received = r[LEDGER_COL_.received - 1] instanceof Date ? r[LEDGER_COL_.received - 1] : null;
      var hasTrial = !!r[LEDGER_COL_.trialDate - 1], hasJoin = !!r[LEDGER_COL_.joinDate - 1];

      // 体験日
      if (!hasTrial) {
        var trial = findTrialThankYou_(email, received);
        if (trial) {
          changes.push({row:rowNo, id:id, col:LEDGER_COL_.trialDate, label:'体験日', value:trial.date, evidence:'送信メール ' + trial.subject + ' (' + trial.msgId + ')'});
          if (status === '問合せ' || status === '日程調整中' || status === '') changes.push({row:rowNo, id:id, col:LEDGER_COL_.status, label:'ステータス', value:'体験済', evidence:'体験日の自動記入に伴う'});
          status = (status === '問合せ' || status === '日程調整中' || status === '') ? '体験済' : status;
        }
      }
      // 入会日
      if (!hasJoin && enrollIndex && enrollIndex[email]) {
        var e = enrollIndex[email];
        if (received && e.date.getTime() < received.getTime() - 86400000) {
          console.log(id + ': 入会申込日が問い合わせより前のため除外（既存会員の可能性）');
        } else {
          changes.push({row:rowNo, id:id, col:LEDGER_COL_.joinDate, label:'入会日', value:e.date, evidence:'入会申込シート ' + e.rowNo + '行目 (' + e.course + ')'});
          if (status !== '入会') changes.push({row:rowNo, id:id, col:LEDGER_COL_.status, label:'ステータス', value:'入会', evidence:'入会日の自動記入に伴う'});
        }
      }
    }
    if (!dryRun) {
      changes.forEach(function(c) {
        var cell = sheet.getRange(c.row, c.col);
        if (cell.getValue()) return; // 実行中に人が入れていたら触らない
        if (c.value instanceof Date) cell.setNumberFormat('yyyy/mm/dd');
        cell.setValue(c.value);
      });
      SpreadsheetApp.flush();
    }
  } finally { lock.releaseLock(); }
  writeAutoLog_(ss, changes, dryRun);
  if (changes.length && !dryRun) notifyAutoSync_(ss, changes);
  console.log((dryRun ? '[DRY RUN] ' : '') + changes.length + ' 件' + (dryRun ? 'が対象' : 'を記入') + 'しました。');
}

function buildEnrollmentIndex_(enrollId) {
  var sh = SpreadsheetApp.openById(enrollId).getSheetByName(ENROLL_SHEET_NAME_);
  if (!sh || sh.getLastRow() < 2) return {};
  var values = sh.getDataRange().getValues(), head = values[0].map(String);
  var cDate = head.indexOf('入会申込日'), cMail = head.indexOf('メールアドレス'), cMail2 = head.indexOf('予備メールアドレス'), cCourse = head.indexOf('コース');
  if (cDate < 0 || cMail < 0) throw new Error('入会申込シートに「入会申込日」「メールアドレス」列が見つかりません。');
  var index = {};
  for (var i = 1; i < values.length; i++) {
    var d = toDate_(values[i][cDate]); if (!d) continue;
    [values[i][cMail], cMail2 >= 0 ? values[i][cMail2] : ''].forEach(function(m) {
      m = String(m || '').trim().toLowerCase(); if (!m) return;
      if (!index[m] || index[m].date.getTime() < d.getTime()) index[m] = {date:d, rowNo:i + 1, course:String(cCourse >= 0 ? values[i][cCourse] : '')};
    });
  }
  return index;
}

// 「M月D日 ◯◯クラス体験のお礼（CCJカポエイラ）」を自分が送っていれば、その日付を返す
function findTrialThankYou_(email, received) {
  var q = 'in:sent to:' + email + ' subject:(体験 お礼)';
  if (received) q += ' after:' + Utilities.formatDate(new Date(received.getTime() - 7 * 86400000), 'Asia/Tokyo', 'yyyy/MM/dd');
  var threads = GmailApp.search(q, 0, 5);
  var best = null;
  threads.forEach(function(t) {
    t.getMessages().forEach(function(m) {
      if (!/体験/.test(m.getSubject()) || !/お礼|ありがとう/.test(m.getSubject() + ' ' + m.getPlainBody().slice(0, 400))) return;
      if (m.getTo().toLowerCase().indexOf(email) < 0) return;
      var sent = m.getDate(), d = dateFromSubject_(m.getSubject(), sent) || new Date(sent.getFullYear(), sent.getMonth(), sent.getDate() - 1);
      if (!best || d.getTime() < best.date.getTime()) best = {date:d, subject:m.getSubject(), msgId:m.getId()};
    });
  });
  return best;
}
function dateFromSubject_(subject, sent) {
  var m = subject.match(/(\d{1,2})月(\d{1,2})日/); if (!m) return null;
  var y = sent.getFullYear(), month = Number(m[1]) - 1, day = Number(m[2]);
  if (month > sent.getMonth() + 1) y -= 1; // 年明け直後に12月の体験を礼状する場合
  var d = new Date(y, month, day); return isNaN(d.getTime()) ? null : d;
}
function toDate_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  var s = String(v || '').trim(); if (!s) return null;
  var m = s.match(/(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/); if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  var d = new Date(s); return isNaN(d.getTime()) ? null : d;
}
function writeAutoLog_(ss, changes, dryRun) {
  var sh = ss.getSheetByName(AUTO_LOG_SHEET_) || ss.insertSheet(AUTO_LOG_SHEET_);
  if (sh.getLastRow() === 0) { sh.appendRow(['実行日時', '区分', 'ID', '行', '項目', '値', '根拠']); sh.setFrozenRows(1); }
  var now = new Date();
  if (!changes.length) { sh.appendRow([now, dryRun ? 'DRY' : '実行', '', '', '変更なし', '', '']); return; }
  sh.getRange(sh.getLastRow() + 1, 1, changes.length, 7).setValues(changes.map(function(c) {
    return [now, dryRun ? 'DRY' : '実行', c.id, c.row, c.label, c.value instanceof Date ? Utilities.formatDate(c.value, 'Asia/Tokyo', 'yyyy/MM/dd') : String(c.value), c.evidence];
  }));
}
function notifyAutoSync_(ss, changes) {
  var lines = changes.map(function(c) { return c.id + ' ' + c.label + ' → ' + (c.value instanceof Date ? Utilities.formatDate(c.value, 'Asia/Tokyo', 'yyyy/MM/dd') : c.value) + '  [' + c.evidence + ']'; });
  try {
    MailApp.sendEmail({to:OWNER_EMAIL_OVERRIDE_, subject:'【台帳 自動記入】' + changes.length + '件', name:'CCJ問い合わせフォーム',
      body:'リード台帳に次を自動記入しました。間違いがあれば台帳を直接修正してください（自動処理は空欄のみ埋め、上書きしません）。\n\n' + lines.join('\n') + '\n\n台帳: ' + ss.getUrl() + '\nログ: シート「' + AUTO_LOG_SHEET_ + '」'});
  } catch (e) { console.log('要約メール送信失敗: ' + e.message); }
}

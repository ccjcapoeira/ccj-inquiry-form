'use strict';
// GAS固有APIをメモリ上で模擬し、外部通信・実メール送信なしで検証する。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
let rows = [], columns = 26, maxRows = 3, present = false, locked = false, mails = [], failMail = '', props = {}, validations = [];
const range = (r,c,n=1,m=1) => {
  assert(c+m-1 <= columns, 'シート列数を超えている');
  assert(r+n-1 <= maxRows, 'シート行数を超えている');
  return {
    getValues(){return Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>rows[r+i-1]?.[c+j-1] ?? ''));},
    setValues(values){assert(locked); assert.equal(values.length,n); values.forEach((row,i)=>{assert.equal(row.length,m); rows[r+i-1] ||= [];row.forEach((v,j)=> rows[r+i-1][c+j-1]=v);});return this;},
    setNumberFormat(){return this;},setFontWeight(){return this;},setBackground(){return this;},
    setDataValidation(rule){validations.push({r,c,n,rule});return this;}
  };
};
const sheet = {getLastRow:()=>rows.length,getLastColumn:()=>Math.max(0,...rows.map(r=>r.length)),getMaxColumns:()=>columns,insertColumnsAfter:(_,n)=>columns+=n,getMaxRows:()=>maxRows,insertRowsAfter:(_,n)=>maxRows+=n,getRange:range,setFrozenRows(){}};
const ss = {getId:()=> 'mock-only',getUrl:()=> 'https://example.invalid/ledger',setSpreadsheetTimeZone(zone){assert.equal(zone,'Asia/Tokyo');},getSheetByName:()=>present?sheet:null,insertSheet(name){assert.equal(name,'リード台帳');present=true;return sheet;}};
const context={console:{log(){}},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],setProperty:(k,v)=>props[k]=v})},SpreadsheetApp:{getActiveSpreadsheet:()=>ss,openById:id=>{assert.equal(id,'mock-only');return ss;},flush(){},newDataValidation:()=>({requireValueInList(values){assert.equal(values.length,6);return this;},setAllowInvalid(value){assert.equal(value,false);return this;},build:()=> 'status-rule'})},MailApp:{getRemainingDailyQuota:()=>100,sendEmail(message){assert(!locked);mails.push(message);if(message.subject.includes(failMail)&&failMail)throw Error('模擬エラー');}},LockService:{getScriptLock:()=>({waitLock(){assert(!locked);locked=true;},releaseLock(){assert(locked);locked=false;}})},Utilities:{formatDate:(date,zone,format)=>format==='yyyyMMdd'?'20260913':'2026/09/13 12:00:00'},ContentService:{MimeType:{JSON:'json'},createTextOutput:value=>({setMimeType:()=>JSON.parse(value)})}};
vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../google-apps-script.js'),'utf8'),context);
const p={name:'動作確認',email:'test@example.invalid',tel:'001234',classType:'kids',dojo:'箕面',requestType:'trial',childAge:'0',firstTouch:'referral_member',firstTouchOther:'消える値',referrerName:'紹介欄の動作確認',preContact:['Google検索','Instagram'],searchWords:'=1+1',message:'<b>入力確認</b>',privacyAgree:true,utm_source:'test',utm_medium:'qr',utm_campaign:'x',utm_content:'',utm_term:'',firstLandingPage:'https://example.invalid/?utm_source=test',firstReferrer:'',currentReferrer:'',submitPage:'https://example.invalid/',userAgent:'検証用',deviceType:'mobile',submittedAt:'2026-09-13T03:00:00.000Z'};
const post=payload=>context.doPost({postData:{contents:JSON.stringify({formType:'inquiry',payload})}});
assert.equal(post(p).result,'error');assert.equal(mails.length,1);assert(mails[0].body.includes(p.email));assert(mails[0].body.includes(p.tel));mails=[];context.setupInquiry();assert.equal(columns,32);assert.equal(rows.length,1);assert.equal(validations[0].c,26);
let result=post(p);assert.equal(result.result,'success');assert.equal(result.id,'INQ-20260913-001');assert.equal(rows.length,2);assert.equal(rows[1].length,32);assert.equal(rows[1][5],'キッズ');assert.equal(rows[1][7],'体験');assert.equal(rows[1][8],'0');assert.equal(rows[1][9],'通っている生徒・保護者からの紹介');assert.equal(rows[1][10],'');assert.equal(rows[1][12],'Google検索、Instagram');assert.equal(rows[1][13],"'=1+1");assert.equal(rows[1][4],'001234');assert.equal(rows[1][25],'問合せ');assert.equal(mails.length,2);assert(mails.every(m=>m.body.includes(result.id)));assert.equal(mails[1].to,'ccj.osaka@gmail.com');assert.equal(mails[1].replyTo,p.email);
const invalid=[{tel:''},{tel:'   '},{tel:undefined},{privacyAgree:false},{childAge:''},{childAge:'-1'},{classType:'bad'},{firstTouch:'__proto__'},{email:'wrong'},{name:'\n'},{preContact:['bad']},{message:'a'.repeat(3001)},{submittedAt:'bad'},{deviceType:'bad'},{dojo:'bad'}];
for(const edit of invalid){assert.equal(post({...p,...edit}).result,'error');assert.equal(rows.length,2);assert(!locked);}
assert.equal(context.doPost({postData:{contents:'{"formType":"enrollment"}'}}).result,'error');assert.equal(context.doPost({postData:{contents:'{'}}).result,'error');
result=post({...p,classType:'adult',firstTouch:'other',firstTouchOther:'補足'});assert.equal(result.id,'INQ-20260913-002');assert.equal(rows[2][8],'');assert.equal(rows[2][10],'補足');assert.equal(rows[2][11],'');
// 中間行削除時に現存IDと衝突しない。初期行容量を超える追記も確認。
rows.splice(1,1);result=post(p);assert.equal(result.id,'INQ-20260913-003');result=post(p);assert.equal(result.id,'INQ-20260913-004');assert.equal(maxRows,4);
const before=rows.length;rows[0][0]='変更されたヘッダー';let mailCount=mails.length;result=post(p);assert.equal(result.result,'success');assert.equal(rows.length,before+1);assert.equal(rows[before][2],p.name);assert.equal(rows[0][0],'変更されたヘッダー');assert.equal(mails.length,mailCount+3);assert(mails.at(-1).body.includes('ヘッダーが変わっています'));assert(mails.at(-1).body.includes(result.id));assert(!locked);rows[0][0]='ID';
// 33列目以降の運用列を保持し、不要な警告を出さない。
columns=33;rows[0][32]='追加列';rows[1][32]='保持';mailCount=mails.length;assert.equal(post(p).result,'success');assert.equal(mails.length,mailCount+2);assert.equal(rows[1][32],'保持');
failMail='お問い合わせを受け付けました';mailCount=mails.length;let rowCount=rows.length;result=post(p);assert.equal(result.result,'error');assert(result.message.includes('台帳保存済み'));assert.equal(rows.length,rowCount+1);assert.equal(mails.length,mailCount+3);assert.equal(mails.at(-1).subject,'【問い合わせ処理エラー】');assert(!locked);
// エラー通知も失敗する場合は再帰しない。
failMail='【問い合わせ処理エラー】';mailCount=mails.length;rowCount=rows.length;result=post({...p,tel:''});assert.equal(result.result,'error');assert.equal(mails.length,mailCount+1);assert.equal(rows.length,rowCount);
console.log('GAS検証合格: 32列固定保存・追加列保持・ヘッダー警告・処理エラー通知・通知失敗時の非再帰・電話必須・採番・保存維持');

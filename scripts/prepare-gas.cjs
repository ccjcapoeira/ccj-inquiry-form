'use strict';
// 初回認証後のコード更新を自動化する。認証情報・IDはGit管理しない。
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.gas');
const state=JSON.parse(fs.readFileSync(path.join(root,'.local/deployment.json'),'utf8'));
if(!state.scriptId)throw new Error('GASの作成済みIDがありません。Codexで初回設定してください。');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'.clasp.json'),JSON.stringify({scriptId:state.scriptId,parentId:state.spreadsheetId,rootDir:''},null,2)+'\n');
fs.copyFileSync(path.join(root,'google-apps-script.js'),path.join(dir,'Code.js'));
fs.writeFileSync(path.join(dir,'appsscript.json'),JSON.stringify({timeZone:'Asia/Tokyo',dependencies:{},exceptionLogging:'STACKDRIVER',runtimeVersion:'V8',oauthScopes:['https://www.googleapis.com/auth/spreadsheets','https://www.googleapis.com/auth/script.send_mail'],webapp:{access:'ANYONE_ANONYMOUS',executeAs:'USER_DEPLOYING'}},null,2)+'\n');
console.log('問い合わせ専用GASの更新ファイルを準備しました。');

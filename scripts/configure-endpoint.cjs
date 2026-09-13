'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),state=JSON.parse(fs.readFileSync(path.join(root,'.local/deployment.json'),'utf8'));
async function main(){
 const url=new URL(state.webAppUrl);
 if(url.origin!=='https://script.google.com'||!/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname))throw new Error('作成済みのGAS URLを確認してください。');
 const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
 const data=await response.json();
 if(data.result!=='ready')throw new Error('Googleの初回承認とsetupInquiryの完了が必要です。');
 const file=path.join(root,'index.html'),source=fs.readFileSync(file,'utf8');
 if(!/^const SCRIPT_URL = '[^']*';$/m.test(source))throw new Error('SCRIPT_URL設定箇所が見つかりません。');
 fs.writeFileSync(file,source.replace(/^const SCRIPT_URL = '[^']*';$/m,"const SCRIPT_URL = '"+url.href+"';"));
 console.log('初回設定の完了を確認して、フォームの送信先を設定しました。');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});

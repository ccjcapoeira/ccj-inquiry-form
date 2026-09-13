'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),state=JSON.parse(fs.readFileSync(path.join(root,'.local/deployment.json'),'utf8'));
if(!state.deploymentId)throw new Error('既存デプロイIDが必要です。新規デプロイはCodexで設定してください。');
execFileSync(process.execPath,[path.join(__dirname,'prepare-gas.cjs')],{stdio:'inherit'});
execFileSync('clasp',['push','--force'],{cwd:path.join(root,'.gas'),stdio:'inherit'});
execFileSync('clasp',['update-deployment',state.deploymentId,'--description','問い合わせ受付 更新'],{cwd:path.join(root,'.gas'),stdio:'inherit'});

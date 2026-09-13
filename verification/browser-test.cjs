'use strict';
// 実行例: NODE_PATH=開発環境のnode_modules CHROME_PATH=Chrome実行ファイル node verification/browser-test.cjs
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..'), base='http://127.0.0.1:8765/';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 // 公開後でも実GASへ送信しないよう、全テスト用コンテキストでフォームをデモ版に差し替える。
 const rawSource=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const demoSource=rawSource.replace(/^const SCRIPT_URL = '[^']*';$/m, "const SCRIPT_URL = '';");
 assert(demoSource.includes("const SCRIPT_URL = '';"));
 const newLocalContext=async options=>{const ctx=await browser.newContext(options);await ctx.route(base+'**',route=>new URL(route.request().url()).pathname==='/'?route.fulfill({contentType:'text/html',body:demoSource}):route.continue());return ctx;};
 const context=await newLocalContext({viewport:{width:390,height:844},locale:'ja-JP'});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'?utm_source=test&utm_medium=qr&utm_campaign=x');
 await page.locator('#review').click();assert(await page.locator('#entry').isVisible());assert(await page.locator('#name').evaluate(e=>!e.validity.valid));
 await page.locator('[name=classType][value=kids]').check();assert(await page.locator('#childAge').isVisible());assert(await page.locator('#childAge').evaluate(e=>e.required));
 await page.locator('#firstTouch').selectOption('other');assert(await page.locator('#firstTouchOther').isVisible());
 await page.locator('#firstTouch').selectOption('referral_friend');assert(await page.locator('#referrerName').isVisible());assert(!(await page.locator('#firstTouchOther').isVisible()));
 await page.goto(base);let payload=await page.evaluate(()=>collectPayload());assert.equal(payload.utm_source,'test');assert.equal(payload.utm_medium,'qr');assert.equal(payload.utm_campaign,'x');assert(payload.firstLandingPage.includes('utm_source=test'));
 await page.reload();assert.equal((await page.evaluate(()=>collectPayload())).utm_campaign,'x');
 // 別キャンペーンで欠けたUTMを古い値と混ぜない。
 await page.goto(base+'?utm_source=instagram');payload=await page.evaluate(()=>collectPayload());assert.equal(payload.utm_source,'instagram');assert.equal(payload.utm_campaign,'');assert(payload.firstLandingPage.includes('utm_source=test'));
 await page.goto(base+'?utm_source=test&utm_medium=qr&utm_campaign=x');
 const fill=async target=>{await target.locator('#name').fill('動作確認');await target.locator('#email').fill('test@example.invalid');await target.locator('[name=classType][value=kids]').check();await target.locator('#dojo').selectOption('箕面');await target.locator('[name=requestType][value=trial]').check();await target.locator('#firstTouch').selectOption('google_search');await target.locator('#privacyAgree').check();};
 await fill(page);await page.locator('#review').click();assert(await page.locator('#entry').isVisible());await page.locator('#childAge').fill('0');
 // 実際の入力には個人情報を使わず、画面・確認表示を検証する。
 await page.locator('summary').click();await page.locator('#message').fill('<img src=x onerror=alert(1)>');await page.locator('[name="preContact[]"]').first().check();
 await page.locator('#review').click();assert(await page.locator('#confirmation').isVisible());assert((await page.locator('#confirmList').innerText()).includes('<img src=x'));assert.equal(await page.locator('#confirmList img').count(),0);assert(!(await page.locator('#confirmList').innerText()).includes('utm_source'));
 await page.locator('#back').click();assert.equal(await page.locator('#name').inputValue(),'動作確認');await page.locator('[name=classType][value=adult]').check();assert(!(await page.locator('#childAge').isVisible()));assert.equal((await page.evaluate(()=>collectPayload())).childAge,'');
 await page.locator('#review').click();await page.locator('#send').click();assert(await page.locator('#done').isVisible());assert((await page.locator('#doneIntro').innerText()).includes('実際の送信'));
 await page.screenshot({path:path.join(__dirname,'完了画面.png'),fullPage:true});
 // POST方式・ペイロード・送信中ロックをローカルで検証。fetchは差し替え、ネットワーク送信しない。
 const source=demoSource.replace("const SCRIPT_URL = '';","const SCRIPT_URL = 'https://example.invalid/mock';");
 await page.route(base,route=>route.fulfill({contentType:'text/html',body:source}));
 await page.addInitScript(()=>{window.fetchCalls=[];window.fetch=async(url,options)=>{window.fetchCalls.push({url,options});await new Promise(resolve=>setTimeout(resolve,250));return {type:'opaque'};};});
 await page.goto(base);await fill(page);await page.locator('#childAge').fill('7');await page.locator('#review').click();await page.locator('#send').evaluate(e=>{e.click();e.click();});assert(await page.locator('#send').isDisabled());assert(await page.locator('#back').isDisabled());await page.locator('#done').waitFor({state:'visible'});
 const calls=await page.evaluate(()=>window.fetchCalls);assert.equal(calls.length,1);assert.equal(calls[0].options.mode,'no-cors');assert.equal(calls[0].options.method,'POST');const body=JSON.parse(calls[0].options.body);assert.equal(body.formType,'inquiry');assert.equal(body.payload.utm_campaign,'x');assert.equal(body.payload.privacyAgree,true);assert.deepEqual(Object.keys(body.payload).sort(),['name','email','tel','classType','dojo','requestType','childAge','firstTouch','firstTouchOther','referrerName','searchWords','message','preContact','privacyAgree','utm_source','utm_medium','utm_campaign','utm_content','utm_term','firstLandingPage','firstReferrer','currentReferrer','submitPage','userAgent','deviceType','submittedAt'].sort());
 // 通信失敗時は確認画面を維持し、再操作を可能にする。
 await page.goto(base);await fill(page);await page.locator('#childAge').fill('7');await page.evaluate(()=>window.fetch=async()=>{throw new Error('模擬通信エラー');});await page.locator('#review').click();await page.locator('#send').click();assert(await page.locator('#sendError').isVisible());assert(!(await page.locator('#send').isDisabled()));assert(await page.locator('#confirmation').isVisible());
 await page.unroute(base);
 const clean=await newLocalContext({viewport:{width:390,height:844},locale:'ja-JP'});const visual=await clean.newPage();await visual.goto(base);
 const widths=[];for(const width of [320,390,768,1280]){await visual.setViewportSize({width,height:844});const measure=await visual.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));assert(measure.scroll<=width);widths.push(measure);}
 await visual.setViewportSize({width:390,height:844});await visual.screenshot({path:path.join(__dirname,'入力画面-390.png'),fullPage:true});
 await visual.locator('summary').click();await visual.locator('[name=classType][value=kids]').check();await visual.locator('#firstTouch').selectOption('referral_member');assert(await visual.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await visual.screenshot({path:path.join(__dirname,'任意項目-390.png'),fullPage:true});
 const unavailable=await newLocalContext();await unavailable.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('使用不可');}}));const blocked=await unavailable.newPage();await blocked.goto(base+'?utm_source=test');const empty=await blocked.evaluate(()=>collectPayload());for(const k of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','firstLandingPage','firstReferrer'])assert.equal(empty[k],'');assert.equal(empty.submitPage,base+'?utm_source=test');
 const nojs=await newLocalContext({javaScriptEnabled:false});const plain=await nojs.newPage();await plain.goto(base);assert(await plain.locator('#name').isVisible());assert(await plain.locator('noscript').isVisible());assert(await plain.locator('#review').isDisabled());
 const redirects=JSON.parse(fs.readFileSync(path.join(root,'redirects.json'),'utf8'));
 await visual.goto(base+'go/index.html');assert.equal(await visual.locator('tbody tr').count(),12);
 // ローカルの転送先を捕捉して外部サイトには到達させない。
 const redirectContext=await newLocalContext();await redirectContext.route('https://**/*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>転送先確認</title>'}));const redirectPage=await redirectContext.newPage();
 for(const [slug,link] of Object.entries(redirects.links)){const target=new URL(redirects[link.to]||link.to);for(const [k,v]of Object.entries(link))if(k.startsWith('utm_'))target.searchParams.set(k,v);await redirectPage.goto(base+'go/'+slug+'.html');await redirectPage.waitForURL(target.href);}
 const nojsRedirect=await newLocalContext({javaScriptEnabled:false});await nojsRedirect.route('https://**/*',r=>r.fulfill({contentType:'text/html',body:'転送確認'}));const meta=await nojsRedirect.newPage();await meta.goto(base+'go/sample-event.html');await meta.waitForURL('https://ccjcapoeira.github.io/ccj-inquiry-form/?utm_source=event&utm_medium=qr&utm_campaign=sample-event');
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(__dirname,'browser-results.json'),JSON.stringify({result:'passed',widths,checks:['必須入力','条件付き年齢・その他・紹介','確認→戻る→完了','HTML入力のテキスト表示','UTM再訪保持・キャンペーン更新','POST全26キー・no-cors','送信中ロック','通信失敗','ストレージ不可','JavaScript無効','12転送ページ','meta refresh'],externalSubmission:false},null,2)+'\n');
 await browser.close();console.log('ブラウザ検証合格。外部送信なし。');
})().catch(e=>{console.error(e);process.exit(1);});

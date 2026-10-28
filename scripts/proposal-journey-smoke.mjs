// All API traffic is mocked. Does not certify live provider output or topic-only design generation.
import { chromium } from 'playwright'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
const origin=process.env.JOURNEY_SMOKE_ORIGIN||'http://127.0.0.1:3019'
const out='docs/proposal-journey-browser';mkdirSync(out,{recursive:true})
const fixture=JSON.parse(readFileSync('src/components/research-design/fixtures/lms-design.json','utf8'))
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:960},reducedMotion:'reduce'})
let count=0;const check=(v,m)=>{count++;if(!v)throw Error(m)};const errors=[];page.on('pageerror',e=>errors.push(e.message))
const responses={};const posts=[],gets=[];let failWriting=false,failJourney=false,failDelete=false,created=0
const spec={title:'LMS adoption',problem:'A scoped learning problem',field:'Education',academicLevel:'MASTERS',geography:'Cape Town',population:'Undergraduate students',unitOfAnalysis:'Student',temporalScope:'2027',framework:'',contribution:'Association',limitations:'One campus',scopeLimits:'One population',citationStyle:'harvard',institutionRequirements:'Reviewed',universityTemplateId:null,methodologyVersion:2,mixedMethodIntegration:'',totalWords:6000,hypothesisApplicability:'NotApplicable',hypothesisRationale:'Descriptive',hypotheses:[],questions:[],objectives:[],constructs:[],dataSources:[],analyses:[],sampling:{design:'Correlation',confidence:.95,margin:null,proportion:null,populationSize:null,effectSize:.3,power:.8,designEffect:1,responseRate:.9,frame:'Registry',rationale:'Primary association'},study:{$family:'Quantitative'}}
let accepted=false,mode=null,affected=false
const state=()=>({accepted:accepted?{id:'revision-b',version:2,hash:'hash',specification:spec}:null,importedDraft:spec,policyVersion:'test',enforcementMode:'Enforced',fingerprint:'private',contracts:[{code:'1.0',title:'Introduction',order:1,targetWords:400,minWords:300,maxWords:500,required:true,dependencies:[],requiresEvidence:true}],findings:[{key:'review',status:'Pending',severity:'Blocker',message:'Review before finishing',sectionCode:null}],evidence:[],gaps:[],reviews:[]})
const readiness=()=>accepted?{mode:'CanonicalResearchDesign',canGenerate:!affected,acceptedRevisionId:'revision-b',acceptedVersion:2,boundRevisionId:affected?'revision-a':'revision-b',validationFingerprint:'private-fingerprint',findings:affected?[{key:'stale',status:'Stale',severity:'Blocker',message:'Your design has changed. Review affected sections.',sectionCode:null}]:[],sections:affected?[{code:'1.0',affected:true,generatedRevisionId:'revision-a',contentVersion:'section-v1',reason:'Population changed'}]:[],allowedActions:affected?['ViewResearchDesign','UseUpdatedDesign','ReviewAffectedSections']:['ViewResearchDesign','Generate']}:null
const summary=(id='p')=>({projectId:id,stage:affected?'NeedsAttention':accepted?mode?'Writing':'ReadyToWrite':'DesignReady',nextAction:affected?'ReviewChanges':accepted?mode?'ContinueWriting':'ChooseWritingMode':'CompleteDesign',allowedActions:['Open','ViewSources','ViewReview',...(accepted&&!affected?['ChooseWritingMode']:[])],designRequired:true,acceptedRevisionId:accepted?'revision-b':null,writingMode:mode,affectedSections:affected?1:0,hasContent:false})
const journey=()=>({summary:summary(),readiness:readiness(),generation:{status:'Idle',completedCount:0,totalCount:25,currentSection:null,wordsWritten:0,failedCount:0}})
let design={...structuredClone(fixture),projectId:'p',status:'ReadyForReview',currentStage:'ReadyForReview',allowedActions:['Accept','Revise','Cancel'],canonicalRevision:null}
let projects=Array.from({length:94},(_,i)=>({id:i===0?'p':`legacy-${i}`,title:i===0?'LMS adoption':`Saved proposal ${i}`,academicLevel:'MASTERS',citationStyle:'harvard',documentMode:'PROPOSAL',generatorMode:i%2?'GENERATOR':'AGENT',createdAt:'2026-10-01T10:00:00Z',updatedAt:'2026-10-05T10:00:00Z',generation:{status:'Idle'}}))
const legacy=id=>({projectId:id,stage:'Writing',nextAction:'ContinueLegacy',allowedActions:['Open'],designRequired:false,acceptedRevisionId:null,writingMode:null,affectedSections:0,hasContent:true})
const newSummary={...summary('new'),stage:'SettingUp',nextAction:'CompleteDesign',allowedActions:['Open'],acceptedRevisionId:null,designRequired:true}
try {
 await page.route('**/api/v1/**',async route=>{
  const r=route.request(),path=new URL(r.url()).pathname;let data=[]
  if(r.method()==='GET')gets.push(path);else posts.push({path,payload:r.postDataJSON()})
  if(path.endsWith('/auth/refresh'))data={accessToken:'mock',user:{id:'student',email:'test@example.test',name:'Student',plan:'Pro',isEmailVerified:true}}
  else if(path==='/api/v1/research/projects'){
   if(r.method()==='POST'){created++;data={...projects[0],id:'new',title:r.postDataJSON().topic};projects.push(data)}else data=projects
  }else if(path.includes('/proposal-journeys')){
   if(failJourney){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'private SQL stack trace'})});return}
   if(path.endsWith('/writing-experience')){if(failWriting){failWriting=false;await route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({message:'private SQL provider routing'})});return};mode=r.postDataJSON().mode}
   data=path==='/api/v1/research/proposal-journeys'?projects.map(p=>p.id==='p'?summary():p.id==='new'?newSummary:legacy(p.id)):path.endsWith('/new')?{summary:newSummary,readiness:null,generation:null}:path.includes('/legacy-')?{summary:legacy(path.split('/').at(-1)),readiness:null,generation:null}:journey()
  }else if(path.includes('/design')){
   if(path.endsWith('/accept')){accepted=true;design={...design,status:'Accepted',allowedActions:['View','Revise'],canonicalRevision:'revision-b'};data={view:design,idempotencyHit:false,backgroundWork:false}}
   else if(path.includes('/projects/new/'))data={...structuredClone(fixture),projectId:'new',status:'NotStarted',allowedActions:['View'],runId:null,attention:'Your topic is saved. A structured study setup is required before we can recommend a research design. Topic-only recommendations are not available yet.'}
   else data=design
  }else if(path.includes('/proposal-workflow')){
   data=path.endsWith('/history')?{revisions:[],artifacts:[],sections:affected?[{sectionCode:'1.0',contentVersion:'section-v1',status:'Edited',content:'My student paragraph stays.'}]:[]}:path.endsWith('/readiness')?readiness():path.endsWith('/proposal-workflow')?state():[]
  }else if(r.method()==='DELETE'&&path.includes('/research/projects/')){
   if(failDelete){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'private failure'})});return}
   projects=projects.filter(p=>!path.endsWith(p.id));data={}
  }else if(path.endsWith('/review-feedback'))data=null
  responses[path]=Array.isArray(data)?data.slice(0,2):data;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data})})
 })
 await page.addInitScript(()=>localStorage.setItem('humaniser-onboarding-seen','true'))
 const openList=async()=>{await page.goto(origin+'/app/proposal-studio');await page.getByRole('button',{name:'New proposal',exact:true}).waitFor();await page.getByText('LMS adoption',{exact:true}).first().waitFor();const skip=page.getByRole('button',{name:'Skip',exact:true});if(await skip.isVisible())await skip.click()}
 const openWorkspace=async(id='p')=>{await page.goto(`${origin}/app/research-agent/${id}/proposal-workflow`);await page.getByRole('heading',{name:'LMS adoption',exact:true}).waitFor()}
 await openList()
 check(await page.getByRole('link',{name:'Documents',exact:true}).isVisible(),'Existing navigation lost')
 check((await page.locator('body').innerText()).includes('All 94'),'Legacy proposals not preserved')
 check(await page.getByRole('button',{name:'New proposal',exact:true}).count()===1,'Multiple creation paths')
 check(!/Autonomous|Guided/.test(await page.locator('#main-content').innerText()),'Premature writing-mode filter')
 check(gets.filter(p=>p.includes('/design')||p.includes('/evidence')).length===0,'List makes per-row agent/evidence requests')
 for(const width of [390,768,1280]){await page.setViewportSize({width,height:900});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`List overflows at ${width}`);await page.screenshot({path:`${out}/list-${width}.png`,fullPage:true})}
 const row=page.getByRole('button',{name:'Open LMS adoption',exact:true})
 await page.waitForTimeout(500);await row.getByRole('button',{name:'Continue design',exact:true}).waitFor();await row.getByRole('button',{name:'More actions'}).focus();await page.keyboard.press('Enter')
 check(page.url().endsWith('/proposal-studio'),'Nested keyboard control opens proposal')
 check(await row.getByRole('button',{name:'Open',exact:true}).isVisible(),'Management open missing')
 check(await row.getByRole('button',{name:'Delete',exact:true}).isVisible(),'Management delete missing')
 check(!/Research Design|Evidence packages|submission review/.test(await row.innerText()),'Academic workflow remains in overflow')
 await row.getByRole('button',{name:'Delete',exact:true}).click();await page.getByRole('dialog').waitFor()
 check(!posts.some(p=>p.path.endsWith('/p')),'Delete executes without confirmation')
 await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click()
 check(!posts.some(p=>p.path.endsWith('/p')),'Cancelled deletion mutated proposal')
 await page.getByRole('button',{name:'New proposal',exact:true}).click();await page.getByLabel('Research topic or idea').fill('A new research idea')
 check(await page.getByRole('button',{name:'Write with guidance',exact:true}).count()===0,'Mode selection before acceptance')
 await page.getByRole('dialog').getByRole('button',{name:'Continue',exact:true}).dblclick();await page.waitForURL('**/new/proposal-workflow')
 check(created===1,'Double click creates duplicate project')
 const creation=posts.find(p=>p.path==='/api/v1/research/projects').payload
 check(creation.designFirst&&creation.topic==='A new research idea'&&!!creation.idempotencyKey,'Creation misses design-first command')
 check(!('methodology' in creation)&&!('specification' in creation),'Setup submits invented design')
 await page.getByText('Topic-only recommendations are not available yet.',{exact:false}).waitFor()
 check(await page.getByRole('button',{name:'Build my research design'}).count()===0,'Broken new-topic start is falsely offered')
 check(await page.getByRole('link',{name:'Open research setup'}).isVisible(),'Blocked topic has no honest recovery path')
 check(!posts.some(p=>p.path.includes('/new/design')||p.path.includes('/new/writing-experience')),'Topic starts paid work automatically')
 await page.screenshot({path:`${out}/topic-setup-blocker.png`,fullPage:true})
 await openWorkspace();await page.getByRole('button',{name:'Accept & continue'}).waitFor();check(await page.getByRole('button',{name:'Refresh proposal',exact:true}).evaluate(e=>getComputedStyle(e).color!=='rgb(255, 255, 255)'),'Secondary control text lacks contrast')
 check(!accepted,'Readiness autoaccepts design')
 check(await page.getByRole('button',{name:'Write with guidance',exact:true}).count()===0,'Writing available before explicit acceptance')
 for(const label of ['Design study','Sources','Proposal','Review'])check(await page.getByRole('button',{name:label,exact:true}).isVisible(),`Missing workspace step ${label}`)
 await page.getByRole('button',{name:'Accept & continue'}).click();await page.getByRole('dialog').getByRole('button',{name:'Accept design',exact:true}).click()
 await page.getByRole('button',{name:'Write with guidance',exact:true}).waitFor()
 check(posts.filter(p=>p.path.endsWith('/accept')).length===1,'Acceptance did not stay explicit')
 check(posts.find(p=>p.path.endsWith('/accept')).payload.expectedVersion===fixture.version,'Acceptance lost version fence')
 check(!posts.some(p=>p.path.endsWith('/writing-experience')),'Acceptance autochooses writing mode')
 failWriting=true;await page.getByRole('button',{name:'Write with guidance',exact:true}).click();await page.getByText('Your proposal or research design changed.',{exact:false}).waitFor()
 check(!(await page.locator('body').innerText()).includes('private SQL'),'Raw backend diagnostics exposed')
 await page.getByRole('button',{name:'Write with guidance',exact:true}).click();await page.getByText('Writing options',{exact:true}).waitFor()
 const choices=posts.filter(p=>p.path.endsWith('/writing-experience'))
 check(choices[0].payload.idempotencyKey===choices[1].payload.idempotencyKey,'Ambiguous writing retry changes key')
 check(choices[1].payload.expectedRevisionId==='revision-b','Guided mode lacks canonical revision')
 check(!posts.some(p=>p.path.includes('/generate')),'Guided selection starts paid section work')
 await page.getByText('Writing options',{exact:true}).click();await page.getByRole('button',{name:'Create first draft',exact:true}).click()
 check(await page.getByRole('dialog').getByText('This uses credits.',{exact:false}).isVisible(),'First draft lacks cost confirmation')
 await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click()
 check(posts.filter(p=>p.path.endsWith('/writing-experience')).length===2,'Cancelled full draft starts generation')
 await page.getByRole('button',{name:'Create first draft',exact:true}).click();const fullDraftReply=page.waitForResponse(r=>r.url().includes('/writing-experience')&&r.status()===200);await page.getByRole('dialog').getByRole('button',{name:'Create draft',exact:true}).click();await fullDraftReply
 const draft=posts.filter(p=>p.path.endsWith('/writing-experience')).at(-1).payload
 check(draft.mode==='FirstDraft'&&draft.expectedRevisionId==='revision-b','First draft uses different authority')
 await page.getByRole('button',{name:'Sources',exact:true}).click();await page.getByRole('heading',{name:'Supporting research',exact:true}).waitFor()
 check(await page.getByRole('heading',{name:'Research evidence',exact:true}).isVisible(),'Sources secondary view missing')
 await page.getByRole('button',{name:'Review',exact:true}).click();await page.getByRole('button',{name:'Finish & download',exact:true}).waitFor()
 check(await page.getByRole('button',{name:'Finish & download',exact:true}).isDisabled(),'Pending academic checks allow finalization')
 await page.goBack();await page.getByRole('heading',{name:'Supporting research',exact:true}).waitFor()
 check(await page.getByRole('heading',{name:'Supporting research',exact:true}).isVisible(),'Browser back loses workspace step')
 affected=true;await openWorkspace();await page.getByText('Your text is preserved.',{exact:false}).waitFor()
 await page.getByRole('button',{name:'Proposal',exact:true}).click();await page.getByRole('button',{name:'Read',exact:true}).click()
 check(await page.getByText('My student paragraph stays.',{exact:true}).isVisible(),'Revision replaces student paragraphs')
 check(await page.getByRole('button',{name:'Generate',exact:true}).isDisabled(),'Stale proposal enables generation')
 await page.screenshot({path:`${out}/stale-desktop.png`,fullPage:true})
 for(const width of [390,768,1280]){await page.setViewportSize({width,height:900});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Workspace overflows at ${width}`);await page.screenshot({path:`${out}/workspace-${width}.png`,fullPage:true})}
 affected=false;failJourney=true;await openWorkspace();await page.getByText('We could not check the next step',{exact:false}).waitFor();await page.getByRole('button',{name:'Proposal',exact:true}).click()
 check(await page.getByRole('button',{name:'Generate',exact:true}).isDisabled(),'Failed readiness enables writing')
 failJourney=false;await openList();await page.getByRole('button',{name:'Open Saved proposal 1',exact:true}).getByRole('button',{name:'Open proposal',exact:true}).click();await page.getByRole('link',{name:'Open your saved proposal',exact:true}).waitFor()
 check((await page.getByRole('link',{name:'Open your saved proposal',exact:true}).getAttribute('href')).includes('/legacy-1?section=1.0'),'Legacy content forced through new acceptance')
 const legacyAuto=legacy('legacy-2');legacyAuto.writingMode='FirstDraft';legacyAuto.nextAction='ContinueWriting';legacyAuto.stage='NeedsAttention';legacyAuto.allowedActions.push('RetryLegacyDraft')
 await page.route('**/api/v1/research/proposal-journeys/legacy-2',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:{summary:legacyAuto,readiness:null,generation:{status:'Cancelled',completedCount:3,totalCount:25,currentSection:'3.1',wordsWritten:1600,failedCount:1}}})}))
 await openWorkspace('legacy-2');await page.getByRole('button',{name:'Resume generation',exact:true}).waitFor();check(await page.getByRole('button',{name:'Resume generation',exact:true}).isVisible(),'Legacy autonomous progress and resume lost')
 await page.getByRole('button',{name:'Resume generation',exact:true}).click();await page.getByRole('dialog').filter({hasText:'Resume your saved draft?'}).waitFor();check(await page.getByText('It has not been validated by the new Research Design workflow.',{exact:false}).isVisible(),'Legacy resume falsely claims accepted design');await page.getByRole('dialog').filter({hasText:'Resume your saved draft?'}).getByRole('button',{name:'Cancel',exact:true}).click();check(!posts.some(p=>p.path.endsWith('/generate-autonomous')),'Cancelled legacy retry starts paid work')
 const thesis={...projects[1],id:'thesis',title:'Existing thesis',documentMode:'DISSERTATION',documentType:'Thesis'};projects.push(thesis)
 await page.goto(origin+'/app/thesis-studio');await page.getByText('Existing thesis',{exact:true}).first().waitFor()
 const thesisRow=page.getByRole('button',{name:'Open Existing thesis',exact:true});check(await thesisRow.getByRole('button',{name:'Preview',exact:true}).isVisible(),'Shared list removed thesis icon controls')
 await thesisRow.getByRole('button',{name:'More actions'}).click();check(await thesisRow.getByRole('button',{name:'Delete',exact:true}).isVisible(),'Shared list removed thesis management')
 check(errors.length===0,`Browser errors: ${errors.join('; ')}`)
 writeFileSync(`${out}/results.json`,JSON.stringify({assertions:count,errors,liveProviders:0,creationRequests:created,commands:posts.map(p=>p.path),topicOnlyJourney:'Blocked honestly; not end-to-end complete'},null,2));console.log(`Proposal journey browser checks passed: ${count} assertions`)
}catch(e){writeFileSync(`${out}/debug.json`,JSON.stringify({error:e.message,errors,gets,responses,url:page.url(),body:(await page.locator('body').innerText()).slice(0,9000)},null,2));throw e}finally{await browser.close()}

// All API traffic intercepted; no live providers or database writes.
import { chromium } from 'playwright'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
const fixture=JSON.parse(readFileSync('src/components/research-design/fixtures/lms-design.json','utf8'))
const spec={title:'LMS adoption',problem:'A scoped learning problem',field:'Education',academicLevel:'Masters',geography:'Cape Town',population:'Undergraduate students',unitOfAnalysis:'Student',temporalScope:'2027',framework:'',contribution:'Association',limitations:'One campus',scopeLimits:'One population',citationStyle:'harvard',institutionRequirements:'Reviewed',universityTemplateId:null,methodologyVersion:0,mixedMethodIntegration:'',totalWords:6000,hypothesisApplicability:'NotApplicable',hypothesisRationale:'Descriptive',hypotheses:[],questions:[{id:'q1',text:'How are usability and satisfaction associated?',design:{intent:'Associate',priority:'Primary',expectedOutput:'Association estimate'}}],objectives:[],constructs:[],dataSources:[],analyses:[],sampling:{design:'ProportionPrecision',confidence:.95,margin:null,proportion:null,populationSize:null,effectSize:null,power:null,designEffect:1,responseRate:1,frame:'Registry',rationale:'Primary association',designMetadata:null},study:{schemaVersion:2,methodologySubtype:'Correlational',design:{$family:'Quantitative',design:'Correlational',intent:'Associate',rationale:'Association only',safeguards:null,evidenceNeeds:[]},samplePlan:null,eligibility:[],instruments:[],budget:null,timeline:[],dataLifecycle:[],decisions:{},unresolvedNeeds:[]}}
let view={...fixture,status:'RequiresInput',currentStage:'RequiresInput',runId:'33333333-3333-4333-8333-333333333333',version:'v1',draft:spec,allowedActions:['ProvideInput','Cancel'],questions:[{id:'details',question:'Complete study details',reason:'Access and planning require clarification',field:'Specification',valueType:'Specification',answerable:true,maxLength:null}]}
const out='docs/research-design-details-browser';mkdirSync(out,{recursive:true})
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:900}})
const posts=[],errors=[];let count=0;const check=(v,m)=>{count++;if(!v)throw Error(m)}
page.on('pageerror',e=>errors.push(e.message))
try {
 await page.route('**/api/v1/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;let data=[]
  if(path.endsWith('/auth/refresh'))data={accessToken:'mock',user:{id:'student',name:'Student',email:'test@example.test',plan:'Pro',isEmailVerified:true}}
  else if(path.includes('/design')){
   if(req.method()==='POST'){posts.push({path,payload:req.postDataJSON()});await new Promise(r=>setTimeout(r,700));view={...view,status:'RequiresEvidence',currentStage:'RequiresEvidence',draft:null,questions:[],allowedActions:['Cancel'],version:'v2'};data={view,idempotencyHit:false,backgroundWork:true}}
   else data=path.endsWith('/history')?{items:[],nextCursor:null}:view
  }
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data})})
 })
 await page.addInitScript(()=>localStorage.setItem('humaniser-onboarding-seen','true'))
 await page.goto('http://127.0.0.1:3019/app/research-design/'+fixture.projectId)
 await page.getByRole('button',{name:'Save details & check design',exact:true}).waitFor()
 const skip=page.getByRole('button',{name:'Skip',exact:true});if(await skip.isVisible())await skip.click()
 const save=page.getByRole('button',{name:'Save details & check design',exact:true})
 check(await save.isDisabled(),'Unreviewed details could submit')
 check(await page.getByLabel('Title',{exact:true}).getAttribute('readonly')!==null,'Title authority editable')
 check(await page.getByLabel(/^Academic level/).isDisabled(),'Level authority editable')
 check(await page.getByRole('link',{name:'Documents',exact:true}).isVisible(),'Existing shell missing')
 await page.getByLabel('Problem statement',{exact:false}).fill('Revised research problem')
 check(posts.length===0,'Edit caused a write')
 for(const width of [390,768,1280]){await page.setViewportSize({width,height:900});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow at '+width)}
 await page.screenshot({path:out+'/structured-details.png',fullPage:true})
 await page.getByLabel('I have reviewed these proposed details and want the design checked again.').check()
 await save.click()
 check(await page.getByLabel('Problem statement',{exact:false}).isDisabled(),'Fields editable while saving')
 await page.getByRole('heading',{name:'Checking the evidence',exact:true}).waitFor()
 check(posts.length===1,'Duplicate input command')
 check(posts[0].path.endsWith('/input'),'Save invoked acceptance')
 check(posts[0].payload.value.specification.problem==='Revised research problem','Edited details missing')
 check(posts[0].payload.value.specification.questions[0].id==='q1','Stable ID lost')
 check(posts[0].payload.value.specification.questions[0].design.intent==='Associate','Typed metadata lost')
 check(posts[0].payload.questionId==='details','Question correlation missing')
 check(!!posts[0].payload.idempotencyKey,'Idempotency key missing')
 check(!posts.some(p=>p.path.endsWith('/accept')),'Design automatically accepted')
 view={...view,status:'RequiresInput',currentStage:'RequiresInput',questions:[{id:'details',valueType:'Specification',answerable:true,question:'Complete study details',field:'Specification'}],draft:null,allowedActions:['ProvideInput']}
 await page.reload();await page.getByText('The editable study details are unavailable.',{exact:false}).waitFor()
 check(await page.getByRole('button',{name:'Save details & check design',exact:true}).count()===0,'Missing draft was invented')
 check(errors.length===0,'Browser errors: '+errors.join(', '))
 writeFileSync(out+'/results.json',JSON.stringify({assertions:count,errors,providers:'mocked',databaseWrites:0},null,2));console.log(JSON.stringify({assertions:count,errors}))
} catch(error) {await page.screenshot({path:out+'/failure.png',fullPage:true});writeFileSync(out+'/failure.html',await page.content());throw error} finally {await browser.close()}



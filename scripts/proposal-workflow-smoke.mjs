// Run against a local frontend. API responses are mocked; no provider calls are made.
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const spec={title:'A scoped learning study',problem:'A local problem',field:'Education',academicLevel:'MASTERS',geography:'Cape Town',population:'Adult learners',unitOfAnalysis:'Learner',temporalScope:'2027',framework:'Learning theory',contribution:'Scoped contribution',limitations:'One site',scopeLimits:'Local study',citationStyle:'harvard',institutionRequirements:'Reviewed',universityTemplateId:null,methodologyVersion:1,mixedMethodIntegration:'',totalWords:6000,hypothesisApplicability:'NotApplicable',hypothesisRationale:'Descriptive design',hypotheses:[],questions:[{id:'q',text:'What is the outcome?'}],objectives:[{id:'o',text:'Estimate outcomes',type:'Specific',questionIds:['q'],constructIds:[],dataSourceIds:['d'],analysisIds:['a']}],constructs:[],dataSources:[{id:'d',name:'Survey',collectionMethod:'Questionnaire',literatureId:null}],analyses:[{id:'a',method:'Descriptive proportions',assumptions:['Probability sample'],missingDataHandling:'Report missingness',strand:'Quantitative'}],sampling:{design:'ProportionPrecision',confidence:.95,margin:.05,proportion:.5,populationSize:null,effectSize:null,power:null,designEffect:1,responseRate:1,frame:'Enrollment registry',rationale:'Precision target'}};
const state={accepted:{id:'revision',version:1,hash:'hash',specification:spec},importedDraft:spec,policyVersion:'proposal-policy.v1',enforcementMode:'Enforced',fingerprint:'current',contracts:[{code:'1.0',title:'Introduction',order:0,targetWords:400,minWords:300,maxWords:500,required:true,dependencies:[],requiresEvidence:true}],findings:[{key:'evidence',status:'Unknown',severity:'Blocker',message:'Exact evidence required',sectionCode:'1.0'}],evidence:[],gaps:[],reviews:[]};
let sectionVersion = 'original-version'; let submittedEdit = null;
await page.route('**/api/v1/**',async route=>{const url=route.request().url();let body={data:[]};if(url.endsWith('/sections/reconcile')){submittedEdit=route.request().postDataJSON();body={data:{}};}else if(url.endsWith('/auth/refresh'))body={accessToken:'mock',user:{id:'user',email:'test@example.test',name:'Researcher',plan:'Pro',wordsUsed:0,wordsLimit:100000,creditsUsed:0,creditsLimit:1000,isEmailVerified:true,createdAt:'2020-01-01'}};else if(url.endsWith('/proposal-workflow'))body={data:state};else if(url.endsWith('/proposal-workflow/history'))body={data:{revisions:[],artifacts:[],sections:[{sectionCode:'1.0',contentVersion:sectionVersion,status:'Draft',content:'Original researcher draft.'}]}};await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});});
await page.addInitScript(()=>{localStorage.setItem('humaniser-onboarding-seen','true')});
await page.goto(`${process.env.PROPOSAL_SMOKE_ORIGIN || 'http://127.0.0.1:5175'}/app/research-agent/mock/proposal-workflow`);
await page.getByRole('heading',{name:'Proposal Research & Review'}).waitFor();
const skip = page.getByRole('button',{name:'Skip',exact:true}); if(await skip.isVisible()) await skip.click();
await page.getByRole('button',{name:'Add hypothesis',exact:true}).click();
await page.getByLabel('1. null Hypothesis').fill('No difference between groups');
await page.getByRole('button',{name:'Claim Evidence',exact:true}).click();
await page.getByRole('heading',{name:'Exact claim and source passage'}).waitFor();
await page.getByRole('button',{name:'Writing & Acceptance',exact:true}).click();
await page.getByRole('button',{name:'Read',exact:true}).click();
await page.getByRole('button',{name:'Edit and Reconcile Draft',exact:true}).click();
await page.getByLabel(/Revised section/).fill('Researcher changes based on the original revision.');
sectionVersion='newer-external-version';
await page.getByRole('button',{name:'Refresh review state',exact:true}).click();
await page.getByRole('button',{name:'Refresh review state',exact:true}).waitFor({state:'visible'});
const editResponse=page.waitForResponse(r=>r.url().endsWith('/sections/reconcile'));
await page.getByRole('button',{name:'Save Reconciled Draft',exact:true}).click(); await editResponse;
if(submittedEdit?.expectedContentVersion!=='original-version')throw Error('Editor failed to pin its original content version');
await page.getByRole('button',{name:'Submission Review',exact:true}).click();
await page.screenshot({path:join(tmpdir(),'humaniser-proposal-review-desktop.png'),fullPage:true});
const finalize=page.getByRole('button',{name:/Finalize/});if(!await finalize.isDisabled())throw Error('Finalization was enabled with blockers');
await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(tmpdir(),'humaniser-proposal-review-mobile.png'),fullPage:true});
if(errors.length)throw Error(errors.join('\n'));console.log('Browser smoke passed: design/hypotheses, evidence, concurrent editor revision, blocked finalization, desktop/mobile.');await browser.close();



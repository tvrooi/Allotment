import { test, expect, open } from './fixtures';

test('records shared expenses, exports personal scope and keeps the bank debit intact', async ({page,api})=>{
  const account=await api.createAccount('My bank',20000);
  const payment=await api.createTransaction({accountId:account.id,date:'2026-10-21',amount:-12000,payeeName:'Dinner'});
  await open(page,'/household');
  await page.getByLabel('Name',{exact:true}).fill('Home');
  await page.getByLabel('People, one per line; put yourself first').fill('Me\nAlex');
  await page.getByRole('button',{name:'Create household',exact:true}).click();
  await expect(page.getByRole('heading',{name:'People & balances'})).toBeVisible();
  const event=page.getByRole('heading',{name:'Record an event'}).locator('..');
  await event.getByLabel('Description',{exact:true}).fill('Shared dinner');
  await event.getByLabel('Date',{exact:true}).fill('2026-10-21');
  await event.getByLabel('Amount (AUD)').fill('120.00');
  await event.getByLabel('Paid by').selectOption({label:'Me'});
  await event.getByLabel('Existing bank payment (optional)').selectOption(payment.id);
  await event.getByRole('button',{name:'Save event'}).click();
  await expect(page.getByRole('heading',{name:/My expense shares:.*60/})).toBeVisible();
  await page.getByLabel('Report scope').selectOption('household');
  await expect(page.getByRole('heading',{name:/Household spending:.*120/})).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Report scope')).toHaveValue('household');
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export this statement'}).click();
  expect((await download).suggestedFilename()).toBe('household-household-statement.json');
  expect((await api.transactions()).find(t=>t.id===payment.id).amount).toBe(-12000);
  await page.screenshot({path:test.info().outputPath('household.png'),fullPage:true});
});

test('prepaid pool expenses do not create a second reimbursement claim',async({page,api})=>{
  const account=await api.createAccount('Joint',0,'checking',{currency:'AUD'});
  const group=await api.call('POST','/households',{name:'Household',currency:'AUD',accountId:account.id,people:['Me','Alex'],selfIndex:0});
  for(const person of group.people) await api.call('POST',`/households/${group.group.id}/events`,{kind:'contribution',date:'2026-10-21',description:'Rent advance',amount:6000,payerId:person.id});
  const payment=await api.createTransaction({accountId:account.id,date:'2026-10-21',amount:-12000,payeeName:'Rent'});
  await api.call('POST',`/households/${group.group.id}/events`,{kind:'expense',date:'2026-10-21',description:'Rent',amount:12000,transactionId:payment.id,shares:group.people.map((p:any)=>({personId:p.id,value:1}))});
  const ledger=await api.call('GET',`/households/${group.group.id}`);
  expect(Object.values(ledger.balances)).toEqual([0,0]);
  await open(page,'/household');
  await expect(page.getByRole('heading',{name:'People & balances'})).toBeVisible();
  await expect(page.getByText(/Received pool funding remaining:/)).toContainText('0.00');
});

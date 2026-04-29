// Tasneef HTML App V3 - Supabase
const SUPABASE_URL = "https://zmjdqiswytxlbfgnfjfv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const today = () => new Date().toISOString().slice(0,10);
const nowTime = () => new Date().toTimeString().slice(0,5);
const session = () => JSON.parse(localStorage.getItem('tasneef_user') || 'null');
const setSession = u => localStorage.setItem('tasneef_user', JSON.stringify(u));
const clearSession = () => localStorage.removeItem('tasneef_user');
const fmt = d => d ? new Date(d).toLocaleString('ar-SA') : '-';
const timeOnly = d => d ? new Date(d).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'}) : '-';
const minsToText = m => { m=Number(m||0); const h=Math.floor(m/60), mm=m%60; return `${h}:${String(mm).padStart(2,'0')}`; };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let data = { users:[], supervisors:[], projects:[], workers:[], attendance:[], logs:[], tickets:[] };
function msg(text, type='ok'){ const el=$('globalMsg')||$('loginMsg'); if(!el) return; el.className='msg '+(type==='err'?'err':''); el.textContent=text; el.classList.remove('hidden'); setTimeout(()=>el.classList.add('hidden'),4000); }
function playAppSound(type){ try{ const files={checkin:'sounds/checkin.wav', checkout:'sounds/checkout.wav', ticket:'sounds/ticket.wav'}; const src=files[type]; if(!src) return; const a=new Audio(src); a.volume=0.75; a.play().catch(()=>{}); }catch(e){} }
function requireRole(role){ const u=session(); if(!u){ location.href='index.html'; return null; } if(role && u.role!==role){ location.href = u.role==='admin' ? 'admin.html' : (u.role==='technician' ? 'technician.html' : 'supervisor.html'); return null; } return u; }
async function login(){
  const username=$('loginUsername').value.trim(), password=$('loginPassword').value.trim();
  if(!username||!password) return msg('أدخل اسم المستخدم وكلمة المرور','err');
  if(username==='admin' && password==='123456'){
    setSession({id:1,full_name:'مدير النظام',username:'admin',role:'admin',is_active:true});
    location.href='admin.html'; return;
  }
  const {data:u,error}=await sb.from('app_users').select('*').eq('username',username).eq('password',password).eq('is_active',true).maybeSingle();
  if(error||!u) return msg(error?.message || 'بيانات الدخول غير صحيحة','err');
  setSession(u); location.href = u.role==='admin' ? 'admin.html' : (u.role==='technician' ? 'technician.html' : 'supervisor.html');
}
function logout(){ clearSession(); location.href='index.html'; }
async function loadAll(){
  const [users, projects, workers, attendance, logs, tickets] = await Promise.all([
    sb.from('app_users').select('*').order('id'),
    sb.from('projects').select('*').order('id'),
    sb.from('workers').select('*').order('id'),
    sb.from('attendance').select('*').order('attendance_date',{ascending:false}),
    sb.from('time_logs').select('*').order('check_in',{ascending:false}),
    sb.from('tickets').select('*').order('created_at',{ascending:false})
  ]);
  for(const r of [users,projects,workers,attendance,logs,tickets]) if(r.error) console.warn(r.error.message);
  data.users = users.data || []; data.supervisors = data.users.filter(u=>u.role==='supervisor' && u.is_active!==false); data.technicians = data.users.filter(u=>u.role==='technician' && u.is_active!==false); data.technicians = data.users.filter(u=>u.role==='technician' && u.is_active!==false);
  data.projects = projects.data || []; data.workers = workers.data || []; data.attendance = attendance.data || []; data.logs = logs.data || []; data.tickets = tickets.data || [];
}
function fillSelect(id, rows, label='name', allLabel=null, value='id'){ const el=$(id); if(!el) return; el.innerHTML = (allLabel!==null?`<option value="">${allLabel}</option>`:'') + rows.map(r=>`<option value="${r[value]}">${esc(r[label]||r.full_name||r.username)}</option>`).join(''); }
function supervisorName(id){ return data.users.find(u=>String(u.id)===String(id))?.full_name || data.supervisors.find(u=>String(u.id)===String(id))?.full_name || '-'; }
function projectName(id){ return data.projects.find(p=>String(p.id)===String(id))?.name || '-'; }
function workerName(id){ return data.workers.find(w=>String(w.id)===String(id))?.name || '-'; }
function getProjectSupervisorId(pid){ return data.projects.find(p=>String(p.id)===String(pid))?.supervisor_id || ''; }
function dateTime(date, time){ return date && time ? new Date(`${date}T${time}:00`).toISOString() : null; }
function minutesBetween(a,b){ if(!a||!b) return 0; return Math.max(0, Math.round((new Date(b)-new Date(a))/60000)); }
function logActualMinutes(l){ const saved = Number(l.duration_minutes); if(Number.isFinite(saved) && saved > 0) return saved; return minutesBetween(l.check_in, l.check_out); }
function logRequiredMinutes(l){ const logDate = l.log_date || String(l.check_in||'').slice(0,10); const current = l.project_id ? requiredMinutesForLog(l.project_id, logDate) : 0; if(current > 0) return current; const saved = Number(l.required_minutes); if(Number.isFinite(saved) && saved > 0) return saved; return 0; }
async function initAdmin(){ requireRole('admin'); await refreshAll(); }
async function refreshAll(){ await loadAll(); hydrateForms(); renderAll(); }
function hydrateForms(){
  const sups = data.supervisors; const pros = data.projects; const workers = data.workers;
  ['logSupervisor','dailySupervisor','projectSupervisor','projectFilterSupervisor','projectManageSupervisor','workerSupervisor','workerFilterSupervisor','attendanceSupervisor','attendanceFilterSupervisor','ticketSupervisor','monthlySupervisor'].forEach(id=>fillSelect(id,sups,'full_name','الكل'));
  fillSelect('manageWorkerSelect', workers, 'name', 'اختر العامل');
  ['logProject','dailyProject','attendanceProject','ticketProject','workerProject','workerFilterProject'].forEach(id=>fillSelect(id,pros,'name','الكل'));
  fillSelect('projectSupervisor',sups,'full_name','بدون مشرف'); fillSelect('workerSupervisor',sups,'full_name','بدون مشرف'); fillSelect('attendanceWorker',workers,'name','اختر العامل');
  if($('logDate')&&!$('logDate').value) $('logDate').value=today(); if($('dailyDate')&&!$('dailyDate').value) $('dailyDate').value=today(); if($('attendanceDate')&&!$('attendanceDate').value) $('attendanceDate').value=today(); if($('attendanceFilterDate')&&!$('attendanceFilterDate').value) $('attendanceFilterDate').value=today(); if($('monthlyMonth')&&!$('monthlyMonth').value) $('monthlyMonth').value=today().slice(0,7);
}
function renderAll(){ renderDashboard(); renderTimeLogs(); renderUsers(); renderProjects(); renderWorkers(); renderAttendance(); renderMonthly(); renderTickets(); renderAlerts(); }
function showPage(id, btn){ document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden')); $(id)?.classList.remove('hidden'); document.querySelectorAll('.nav').forEach(n=>n.classList.remove('active')); btn?.classList.add('active'); renderAll(); }
function renderDashboard(){ if(!$('kpiUsers')) return; $('kpiUsers').textContent=data.users.length; $('kpiProjects').textContent=data.projects.length; $('kpiWorkers').textContent=data.workers.length; $('kpiTodayLogs').textContent=data.logs.filter(l=>(l.log_date||String(l.check_in||'').slice(0,10))===today()).length; const div=$('todaySummary'); if(div) div.innerHTML = data.supervisors.map(s=>{ const logs=data.logs.filter(l=>String(l.supervisor_id)===String(s.id)&&(l.log_date||String(l.check_in||'').slice(0,10))===today()); const mins=logs.reduce((a,l)=>a+(l.duration_minutes||minutesBetween(l.check_in,l.check_out)),0); return `<div class="summary-item"><b>${esc(s.full_name)}</b><br>عدد التسجيلات: ${logs.length}<br>إجمالي الوقت: ${minsToText(mins)}</div>`; }).join('') || '<div class="summary-item">لا توجد تسجيلات اليوم</div>'; }
function setNow(id){ $(id).value=nowTime(); }
function clearLogForm(){ ['logId','logIn','logOut','logTravel','logNotes'].forEach(id=>{ if($(id)) $(id).value=id==='logTravel'?'0':''; }); if($('logDate')) $('logDate').value=today(); if($('logVisitType')) $('logVisitType').value='surface'; $('logFormTitle') && ($('logFormTitle').textContent='تسجيل دخول / خروج'); }
function findProject(id){ return data.projects.find(p=>String(p.id)===String(id)); }
function requiredMinutesForLog(projectId, dateStr){ const p=findProject(projectId); if(!p) return 0; return projectRequiredMinutes(p, dateStr); }
function calculateTravelMinutes(supervisorId, dateStr, checkInIso, currentId=null){
  if(!supervisorId || !dateStr || !checkInIso) return 0;
  const checkIn = new Date(checkInIso);
  const previous = data.logs
    .filter(l => String(l.supervisor_id)===String(supervisorId)
      && String(l.id)!==String(currentId||'')
      && (l.log_date || String(l.check_in||'').slice(0,10))===dateStr
      && l.check_out
      && new Date(l.check_out) <= checkIn)
    .sort((a,b)=> new Date(b.check_out) - new Date(a.check_out))[0];
  if(!previous) return 0;
  return Math.max(0, Math.round((checkIn - new Date(previous.check_out))/60000));
}
function monthDays(year, monthIndex){ return new Date(year, monthIndex+1, 0).getDate(); }
function projectRequiredMonthlyMinutes(projectId, monthStr){
  const p=findProject(projectId); if(!p || !monthStr) return 0;
  if((p.operation_type||'')==='as_needed') return 0;
  const parts=monthStr.split('-').map(Number), y=parts[0], m=parts[1];
  let total=0; const days=monthDays(y,m-1);
  for(let d=1; d<=days; d++){
    const ds=y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    total += projectRequiredMinutes(p, ds);
  }
  return total;
}
function performanceStatus(percent, required){
  percent = Number(percent || 0);
  if(!required) return {text:'غير محدد', cls:'amber'};

  // 90% إلى 110% = ممتاز
  // 70% إلى 89% أو 111% إلى 140% = جيد
  // أقل من 70% أو أكثر من 140% = ضعيف
  if(percent >= 90 && percent <= 110) return {text:'ممتاز', cls:'green'};
  if((percent >= 70 && percent < 90) || (percent > 110 && percent <= 140)) return {text:'جيد', cls:'amber'};
  return {text:'ضعيف', cls:'red'};
}
function percentText(v){ return (Math.round(Number(v||0)*10)/10).toFixed(1)+'%'; }
function calcTimeStatus(actualMinutes, requiredMinutes){ const diff = Number(actualMinutes||0) - Number(requiredMinutes||0); if(!requiredMinutes) return {diff, status:'unknown', text:'غير محدد', cls:'amber'}; if(diff > 5) return {diff, status:'over_time', text:'زيادة', cls:'red'}; if(diff < -5) return {diff, status:'under_time', text:'ناقص', cls:'amber'}; return {diff, status:'within_time', text:'ضمن الوقت', cls:'green'}; }
function timeStatusText(s){ return s==='over_time'?'زيادة':(s==='under_time'?'ناقص':(s==='within_time'?'ضمن الوقت':'غير محدد')); }
function timeStatusClass(s){ return s==='over_time'?'red':(s==='under_time'?'amber':(s==='within_time'?'green':'amber')); }
function diffText(m){ m=Number(m||0); return (m>0?'+':'') + m + ' دقيقة'; }
function logDateText(l){ return l.log_date || String(l.check_in || l.created_at || today()).slice(0,10); }
function logWorkersNames(l){
  const pid=String(l.project_id||''), sid=String(l.supervisor_id||'');
  const seen=new Set();
  const names=[];
  (data.workers||[]).filter(w =>
    (pid && String(workerProjectId(w)||'')===pid) ||
    (!pid && sid && String(workerSupId(w)||'')===sid)
  ).filter(w => String(w.status||'active').toLowerCase() !== 'inactive' && String(w.status||'active').toLowerCase() !== 'deleted')
  .forEach(w=>{
    const raw=String(w.name||'').trim();
    if(!raw) return;
    const key=(typeof tasneefNormNameV60==='function'?tasneefNormNameV60(raw):raw.replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ').trim());
    if(key && !seen.has(key)){ seen.add(key); names.push(raw); }
  });
  return names.join('، ') || '-';
}
function buildLogWhatsAppMessage(l, type){
  const isOut = type==='out' || !!l.check_out;
  const title = isOut ? 'انصراف المشرف وعماله' : 'حضور المشرف وعماله';
  const timeLabel = isOut ? 'وقت الانصراف' : 'وقت الحضور';
  return [
    title,
    '',
    'المشرف: ' + supervisorName(l.supervisor_id),
    'اسم المشروع: ' + projectName(l.project_id),
    'نوع التنظيف: ' + visitTypeText(l.visit_type),
    'أسماء العمال: ' + logWorkersNames(l),
    'التاريخ: ' + logDateText(l),
    timeLabel + ': ' + (isOut ? timeOnly(l.check_out) : timeOnly(l.check_in))
  ].join('\n');
}
function copyWhatsappText(text){
  try{ if(navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).catch(()=>{}); }catch(e){}
  try{ const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }catch(e){}
  return Promise.resolve();
}
function prepareWhatsappPopupV63(){
  try{
    const w = window.open('', '_blank');
    if(w){
      try{ w.document.write('<html dir="rtl"><head><title>فتح واتساب</title></head><body style="font-family:Tahoma;padding:30px;text-align:center"><h3>جاري تجهيز رسالة واتساب...</h3><p>إذا لم ينتقل تلقائيًا، ارجع للتطبيق واضغط زر واتساب.</p></body></html>'); w.document.close(); }catch(e){}
      window.__tasneefWaPopup = w;
    }
    return w;
  }catch(e){ return null; }
}
function openWhatsappText(text){
  const url = 'https://wa.me/?text=' + encodeURIComponent(text);
  let w = window.__tasneefWaPopup || null;
  window.__tasneefWaPopup = null;
  try{
    if(w && !w.closed){ w.location.href = url; return true; }
  }catch(e){}
  try{
    const opened = window.open(url, '_blank');
    if(opened) return true;
  }catch(e){}
  try{
    const a=document.createElement('a');
    a.href=url; a.target='_blank'; a.rel='noopener';
    document.body.appendChild(a); a.click(); a.remove();
    return true;
  }catch(e){}
  return false;
}
function sendLogWhatsapp(id,type){
  const l=(data.logs||[]).find(x=>String(x.id)===String(id));
  if(!l) return msg('السجل غير موجود','err');
  const msgText=buildLogWhatsAppMessage(l, type || (l.check_out?'out':'in'));
  openWhatsappText(msgText);
  copyWhatsappText(msgText).catch(()=>{});
  msg('تم تجهيز رسالة الواتساب');
}
function sendLogWhatsappFromRow(row,type){
  const msgText=buildLogWhatsAppMessage(row, type || (row.check_out?'out':'in'));
  const ok = openWhatsappText(msgText);
  copyWhatsappText(msgText).catch(()=>{});
  msg(ok ? 'تم فتح واتساب وتجهيز الرسالة' : 'تم نسخ رسالة الواتساب، افتح واتساب والصقها');
}
function logWhatsappButtons(l){
  if(l.check_out){ return `<button class="small" style="background:#128C7E;color:#fff" onclick="sendLogWhatsapp(${l.id},'out')">واتساب خروج</button>`; }
  return `<button class="small" style="background:#128C7E;color:#fff" onclick="sendLogWhatsapp(${l.id},'in')">واتساب دخول</button>`;
}
function onLogProjectChange(){ const pid=$('logProject')?.value; const p=findProject(pid); if(p && $('logVisitType')) $('logVisitType').value=p.visit_type_default||'surface'; if(p && $('logSupervisor') && !$('logSupervisor').value) $('logSupervisor').value=p.supervisor_id||''; }
async function saveTimeLog(){ const u=session(); const id=$('logId')?.value; const date=$('logDate')?.value || today(); let sup=$('logSupervisor')?.value || (u.role==='supervisor'?u.id:''); const project=$('logProject')?.value; if(!sup && project) sup=getProjectSupervisorId(project); const check_in=dateTime(date,$('logIn')?.value), check_out=dateTime(date,$('logOut')?.value); if(!project||!check_in) return msg('المشروع ووقت الدخول مطلوبان','err'); const actual=minutesBetween(check_in,check_out); const required=requiredMinutesForLog(project,date); const ts=calcTimeStatus(actual,required); const autoTravel=calculateTravelMinutes(sup,date,check_in,id); const row={user_id:u.id, supervisor_id:Number(sup)||null, project_id:Number(project), check_in, check_out, log_date:date, duration_minutes:actual, travel_minutes:autoTravel, visit_type:$('logVisitType')?.value||findProject(project)?.visit_type_default||'surface', required_minutes:required, time_difference_minutes:ts.diff, time_status:ts.status, notes:$('logNotes')?.value||''}; let res = id ? await sb.from('time_logs').update(row).eq('id',id).select('*').maybeSingle() : await sb.from('time_logs').insert(row).select('*').single(); if(res.error) return msg(res.error.message,'err'); const savedRow = res.data ? res.data : Object.assign({id:Number(id)||0}, row); playAppSound(check_out ? 'checkout' : 'checkin'); msg('تم حفظ التسجيل وحساب حالة الوقت ووقت التنقل تلقائياً'); sendLogWhatsappFromRow(savedRow, check_out ? 'out' : 'in'); clearLogForm(); await refreshAll(); }
function filterLogs(){ let rows=[...data.logs]; const d=$('dailyDate')?.value, s=$('dailySupervisor')?.value, p=$('dailyProject')?.value, q=($('dailySearch')?.value||'').trim(); if(d) rows=rows.filter(l=>(l.log_date||String(l.check_in||'').slice(0,10))===d); if(s) rows=rows.filter(l=>String(l.supervisor_id)===String(s)); if(p) rows=rows.filter(l=>String(l.project_id)===String(p)); if(q) rows=rows.filter(l=>[supervisorName(l.supervisor_id),projectName(l.project_id),visitTypeText(l.visit_type),timeStatusText(l.time_status),l.notes].join(' ').includes(q)); return rows; }
function renderTimeLogs(){ const body=$('logsBody'); if(!body) return; const isSupervisorPage = !document.getElementById('daily'); const rows=filterLogs(); body.innerHTML = rows.map(l=>{ const logDate=l.log_date||String(l.check_in||'').slice(0,10); const actual=Number(l.duration_minutes||minutesBetween(l.check_in,l.check_out)); const required=logRequiredMinutes(l); const diff=(l.time_difference_minutes!==null&&l.time_difference_minutes!==undefined)?Number(l.time_difference_minutes):(actual-required); const status=l.time_status||calcTimeStatus(actual,required).status; const badge=`<span class="badge ${timeStatusClass(status)}">${timeStatusText(status)}</span>`; if(isSupervisorPage){ return `<tr><td>${esc(projectName(l.project_id))}</td><td>${visitTypeText(l.visit_type)}</td><td>${timeOnly(l.check_in)}</td><td>${timeOnly(l.check_out)}</td><td>${minsToText(required)}</td><td>${minsToText(actual)}</td><td>${badge}</td><td class="row-actions">${logWhatsappButtons(l)}</td></tr>`; } return `<tr><td>${esc(logDate)}</td><td>${esc(supervisorName(l.supervisor_id))}</td><td>${esc(projectName(l.project_id))}</td><td>${visitTypeText(l.visit_type)}</td><td>${timeOnly(l.check_in)}</td><td>${timeOnly(l.check_out)}</td><td>${minsToText(required)}</td><td>${minsToText(actual)}</td><td>${diffText(diff)}</td><td>${badge}</td><td>${l.travel_minutes||0}</td><td>${esc(l.notes)}</td><td class="row-actions">${logWhatsappButtons(l)}</td><td class="row-actions"><button onclick="editTimeLog(${l.id})">تعديل</button><button class="danger" onclick="deleteRow('time_logs',${l.id})">حذف</button></td></tr>`; }).join('') || (isSupervisorPage?'<tr><td colspan="8">لا توجد بيانات</td></tr>':'<tr><td colspan="14">لا توجد بيانات</td></tr>'); }
function editTimeLog(id){ const l=data.logs.find(x=>x.id===id); if(!l) return; $('logId').value=l.id; $('logDate').value=l.log_date||String(l.check_in||'').slice(0,10); if($('logSupervisor')) $('logSupervisor').value=l.supervisor_id||''; $('logProject').value=l.project_id||''; if($('logVisitType')) $('logVisitType').value=l.visit_type||findProject(l.project_id)?.visit_type_default||'surface'; $('logIn').value=l.check_in?new Date(l.check_in).toTimeString().slice(0,5):''; $('logOut').value=l.check_out?new Date(l.check_out).toTimeString().slice(0,5):''; $('logTravel').value=l.travel_minutes||0; $('logNotes').value=l.notes||''; $('logFormTitle') && ($('logFormTitle').textContent='تعديل تسجيل'); window.scrollTo({top:0,behavior:'smooth'}); }
async function deleteRow(table,id){ if(!confirm('تأكيد الحذف؟')) return; const {error}=await sb.from(table).delete().eq('id',id); if(error) return msg(error.message,'err'); msg('تم الحذف'); await refreshAll(); }
function clearUserForm(){ ['userId','userFullName','userUsername','userPassword'].forEach(id=>$(id)&&($(id).value='')); if($('userRole')) $('userRole').value='supervisor'; if($('userActive')) $('userActive').value='true'; $('userFormTitle')&&($('userFormTitle').textContent='إضافة مستخدم'); }
async function saveUser(){ const id=$('userId').value; const row={full_name:$('userFullName').value.trim(), username:$('userUsername').value.trim(), password:$('userPassword').value.trim()||'123456', role:$('userRole').value, is_active:$('userActive').value==='true'}; if(!row.full_name||!row.username) return msg('الاسم واسم المستخدم مطلوبان','err'); const res=id?await sb.from('app_users').update(row).eq('id',id):await sb.from('app_users').insert(row); if(res.error) return msg(res.error.message,'err'); msg('تم حفظ المستخدم'); clearUserForm(); await refreshAll(); }
function renderUsers(){ const b=$('usersBody'); if(!b) return; b.innerHTML=data.users.map(u=>`<tr><td>${esc(u.full_name)}</td><td>${esc(u.username)}</td><td><span class="badge">${u.role==='admin'?'مدير':(u.role==='technician'?'فني':'مشرف')}</span></td><td><span class="badge ${u.is_active?'green':'red'}">${u.is_active?'نشط':'موقوف'}</span></td><td class="row-actions"><button onclick="editUser(${u.id})">تعديل</button><button class="danger" onclick="deleteRow('app_users',${u.id})">حذف</button></td></tr>`).join(''); }
function editUser(id){ const u=data.users.find(x=>x.id===id); if(!u)return; $('userId').value=u.id; $('userFullName').value=u.full_name||''; $('userUsername').value=u.username||''; $('userPassword').value=u.password||''; $('userRole').value=u.role; $('userActive').value=String(u.is_active!==false); $('userFormTitle').textContent='تعديل مستخدم'; }
function projectOperationText(t){ return t==='full_time'?'دوام كامل':(t==='as_needed'?'حسب الحاجة':'زيارة يومية'); }
function visitTypeText(t){ return t==='deep'?'نظافة عميقة':'نظافة سطحية'; }
function projectRequiredMinutes(p, dateStr){ const day=dateStr?new Date(dateStr+'T00:00:00').getDay():null; return day===5?Number(p.friday_minutes??90):Number(p.required_daily_minutes??180); }
function clearProjectForm(){ ['projectId','projectName','projectLocation','projectNotes'].forEach(id=>$(id)&&($(id).value='')); if($('projectSupervisor')) $('projectSupervisor').value=''; if($('projectStatus')) $('projectStatus').value='active'; if($('projectRequiredDaily')) $('projectRequiredDaily').value=180; if($('projectFridayMinutes')) $('projectFridayMinutes').value=90; if($('projectOperationType')) $('projectOperationType').value='daily_visit'; if($('projectVisitDefault')) $('projectVisitDefault').value='surface'; $('projectFormTitle')&&($('projectFormTitle').textContent='إضافة مشروع'); $('projectSaveBtn')&&($('projectSaveBtn').textContent='حفظ المشروع'); }
async function saveProject(){ const id=$('projectId').value; const row={name:$('projectName').value.trim(), location:$('projectLocation').value.trim(), supervisor_id:Number($('projectSupervisor').value)||null, required_daily_minutes:Number($('projectRequiredDaily')?.value||180), friday_minutes:Number($('projectFridayMinutes')?.value||90), operation_type:$('projectOperationType')?.value||'daily_visit', visit_type_default:$('projectVisitDefault')?.value||'surface', status:$('projectStatus').value, notes:$('projectNotes').value}; if(!row.name) return msg('اسم المشروع مطلوب','err'); const res=id?await sb.from('projects').update(row).eq('id',id):await sb.from('projects').insert(row); if(res.error) return msg(res.error.message,'err'); msg(id?'تم تحديث المشروع':'تم حفظ المشروع'); clearProjectForm(); await refreshAll(); }
function renderProjects(){ const b=$('projectsBody'); if(!b) return; const q=($('projectSearch')?.value||'').trim(), sid=$('projectFilterSupervisor')?.value, st=$('projectFilterStatus')?.value; let rows=data.projects; if(q) rows=rows.filter(p=>[p.name,p.location,supervisorName(p.supervisor_id),p.notes].join(' ').includes(q)); if(sid) rows=rows.filter(p=>String(p.supervisor_id)===String(sid)); if(st) rows=rows.filter(p=>(p.status||'active')===st); b.innerHTML=rows.map(p=>`<tr><td><b>${esc(p.name)}</b><br><small>${esc(p.location||'')}</small></td><td>${esc(supervisorName(p.supervisor_id))}</td><td>${minsToText(p.required_daily_minutes??180)}</td><td>${minsToText(p.friday_minutes??90)}</td><td>${projectOperationText(p.operation_type)}</td><td>${visitTypeText(p.visit_type_default)}</td><td><span class="badge ${p.status==='inactive'?'red':'green'}">${p.status==='inactive'?'متوقف':'نشط'}</span></td><td class="row-actions"><button onclick="editProject(${p.id})">تعديل</button><button class="light" onclick="openProjectManager(${p.id})">إدارة المشروع</button><button class="light" onclick="toggleProjectStatus(${p.id})">${p.status==='inactive'?'تفعيل':'إيقاف'}</button><button class="danger" onclick="deleteRow('projects',${p.id})">حذف</button></td></tr>`).join('')||'<tr><td colspan="8">لا توجد بيانات</td></tr>'; renderProjectManager(); }
function editProject(id){ const p=data.projects.find(x=>x.id===id); if(!p)return; $('projectId').value=p.id; $('projectName').value=p.name||''; $('projectLocation').value=p.location||''; $('projectSupervisor').value=p.supervisor_id||''; $('projectStatus').value=p.status||'active'; $('projectNotes').value=p.notes||''; if($('projectRequiredDaily')) $('projectRequiredDaily').value=p.required_daily_minutes??180; if($('projectFridayMinutes')) $('projectFridayMinutes').value=p.friday_minutes??90; if($('projectOperationType')) $('projectOperationType').value=p.operation_type||'daily_visit'; if($('projectVisitDefault')) $('projectVisitDefault').value=p.visit_type_default||'surface'; $('projectFormTitle').textContent='تعديل مشروع'; $('projectSaveBtn')&&($('projectSaveBtn').textContent='تحديث المشروع'); }
async function toggleProjectStatus(id){ const p=data.projects.find(x=>x.id===id); if(!p)return; const next=p.status==='inactive'?'active':'inactive'; const {error}=await sb.from('projects').update({status:next}).eq('id',id); if(error) return msg(error.message,'err'); msg(next==='active'?'تم تفعيل المشروع':'تم إيقاف المشروع'); await refreshAll(); }
function openProjectManager(id){ const p=data.projects.find(x=>x.id===id); if(!p)return; $('manageProjectId').value=id; $('projectManagerCard')?.classList.remove('hidden'); $('projectManagerTitle').textContent=`إدارة المشروع: ${p.name}`; if($('projectManageSupervisor')) $('projectManageSupervisor').value=p.supervisor_id||''; renderProjectManager(); setTimeout(()=>$('projectManagerCard')?.scrollIntoView({behavior:'smooth',block:'start'}),50); }
function closeProjectManager(){ $('projectManagerCard')?.classList.add('hidden'); if($('manageProjectId')) $('manageProjectId').value=''; }
function renderProjectManager(){ const b=$('projectWorkersBody'); if(!b) return; const pid=$('manageProjectId')?.value; if(!pid){ b.innerHTML='<tr><td colspan="5">اختر مشروع من زر إدارة المشروع</td></tr>'; return; } const rows=data.workers.filter(w=>String(workerProjectId(w))===String(pid)); b.innerHTML=rows.map(w=>`<tr><td>${esc(w.name)}</td><td>${esc(supervisorName(workerSupId(w)))}</td><td><span class="badge ${w.worker_type==='support'?'amber':'green'}">${workerTypeText(w.worker_type)}</span></td><td><span class="badge ${w.status==='inactive'?'red':'green'}">${w.status==='inactive'?'موقوف':'نشط'}</span></td><td class="row-actions"><button class="danger" onclick="removeWorkerFromProject(${w.id})">إزالة من المشروع</button></td></tr>`).join('')||'<tr><td colspan="5">لا يوجد عمال مرتبطون بهذا المشروع</td></tr>'; }
async function saveProjectManagerSupervisor(){ const pid=Number($('manageProjectId')?.value), sid=Number($('projectManageSupervisor')?.value)||null; if(!pid) return msg('اختر المشروع أولاً','err'); const {error}=await sb.from('projects').update({supervisor_id:sid}).eq('id',pid); if(error) return msg(error.message,'err'); await sb.from('workers').update({supervisor_id:sid, app_supervisor_id:sid}).eq('project_id',pid); msg('تم ربط المشرف بالمشروع وتحديث عمال المشروع'); await refreshAll(); openProjectManager(pid); }
async function addExistingWorkerToProject(){ const pid=Number($('manageProjectId')?.value), wid=Number($('manageWorkerSelect')?.value), type=$('manageWorkerType')?.value||'primary'; if(!pid||!wid) return msg('اختر المشروع والعامل','err'); const p=data.projects.find(x=>x.id===pid); const sid=p?.supervisor_id||null; const {error}=await sb.from('workers').update({project_id:pid, supervisor_id:sid, app_supervisor_id:sid, worker_type:type}).eq('id',wid); if(error) return msg(error.message,'err'); msg('تم ربط العامل بالمشروع'); await refreshAll(); openProjectManager(pid); }
async function removeWorkerFromProject(wid){ if(!confirm('إزالة العامل من هذا المشروع؟')) return; const pid=Number($('manageProjectId')?.value); const {error}=await sb.from('workers').update({project_id:null}).eq('id',wid); if(error) return msg(error.message,'err'); msg('تمت إزالة العامل من المشروع'); await refreshAll(); if(pid) openProjectManager(pid); }
async function addWorkerInsideProject(){ const pid=Number($('manageProjectId')?.value); if(!pid) return msg('اختر المشروع أولاً','err'); const name=$('manageNewWorkerName')?.value.trim(); if(!name) return msg('اسم العامل مطلوب','err'); const p=data.projects.find(x=>x.id===pid); const sid=p?.supervisor_id||null; const row={name, phone:$('manageNewWorkerPhone')?.value.trim()||'', salary:Number($('manageNewWorkerSalary')?.value||1500), supervisor_id:sid, app_supervisor_id:sid, project_id:pid, worker_type:$('manageNewWorkerType')?.value||'primary', status:'active'}; const {error}=await sb.from('workers').insert(row); if(error) return msg(error.message,'err'); ['manageNewWorkerName','manageNewWorkerPhone'].forEach(id=>$(id)&&($(id).value='')); if($('manageNewWorkerSalary')) $('manageNewWorkerSalary').value=1500; msg('تم إضافة العامل وربطه بالمشروع'); await refreshAll(); openProjectManager(pid); }
function clearWorkerForm(){
  ['workerId','workerName','workerPhone','workerNotes'].forEach(id=>$(id)&&($(id).value=''));
  if($('workerSalary')) $('workerSalary').value=1500;
  if($('workerSupervisor')) $('workerSupervisor').value='';
  if($('workerProject')) $('workerProject').value='';
  if($('workerType')) $('workerType').value='primary';
  if($('workerStatus')) $('workerStatus').value='active';
  $('workerFormTitle')&&($('workerFormTitle').textContent='إضافة عامل');
  $('workerSaveBtn')&&($('workerSaveBtn').textContent='حفظ العامل');
  $('workerCancelBtn')&&$('workerCancelBtn').classList.add('hidden');
}
function workerSupId(w){ return w.app_supervisor_id || w.supervisor_id; }
function workerProjectId(w){ return w.project_id || w.assigned_project_id || ''; }
function workerTypeText(t){ return t==='support' ? 'بديل / مساند' : 'أساسي'; }
function onWorkerSupervisorChange(){
  const sid=$('workerSupervisor')?.value;
  const el=$('workerProject');
  if(!el) return;
  let rows=data.projects;
  if(sid) rows=rows.filter(p=>String(p.supervisor_id)===String(sid));
  fillSelect('workerProject', rows, 'name', 'اختر المشروع');
}
async function saveWorker(){
  const id=$('workerId').value;
  const supId=Number($('workerSupervisor').value)||null;
  const projectId=Number($('workerProject')?.value)||null;
  const row={
    name:$('workerName').value.trim(),
    phone:$('workerPhone').value.trim(),
    salary:Number($('workerSalary').value||1500),
    supervisor_id:supId,
    app_supervisor_id:supId,
    project_id:projectId,
    worker_type:$('workerType')?.value||'primary',
    status:$('workerStatus').value,
    notes:$('workerNotes').value
  };
  if(!row.name) return msg('اسم العامل مطلوب','err');
  if(!row.supervisor_id) return msg('اختر المشرف المسؤول عن العامل','err');
  const res=id?await sb.from('workers').update(row).eq('id',id):await sb.from('workers').insert(row);
  if(res.error) return msg(res.error.message,'err');
  msg(id?'تم تحديث العامل':'تم حفظ العامل');
  clearWorkerForm();
  await refreshAll();
}
function renderWorkers(){
  const b=$('workersBody'); if(!b) return;
  const s=$('workerFilterSupervisor')?.value, p=$('workerFilterProject')?.value, st=$('workerFilterStatus')?.value, tp=$('workerFilterType')?.value, q=($('workerSearch')?.value||'').trim();
  let rows=data.workers;
  if(s) rows=rows.filter(w=>String(workerSupId(w))===String(s));
  if(p) rows=rows.filter(w=>String(workerProjectId(w))===String(p));
  if(st) rows=rows.filter(w=>(w.status||'active')===st);
  if(tp) rows=rows.filter(w=>(w.worker_type||'primary')===tp);
  if(q) rows=rows.filter(w=>[w.name,w.phone,supervisorName(workerSupId(w)),projectName(workerProjectId(w)),w.notes].join(' ').includes(q));
  b.innerHTML=rows.map(w=>`<tr><td>${esc(w.name)}</td><td>${esc(supervisorName(workerSupId(w)))}</td><td>${esc(projectName(workerProjectId(w)))}</td><td><span class="badge ${w.worker_type==='support'?'amber':'green'}">${workerTypeText(w.worker_type)}</span></td><td>${esc(w.phone)}</td><td>${w.salary||0}</td><td><span class="badge ${w.status==='inactive'?'red':'green'}">${w.status==='inactive'?'موقوف':'نشط'}</span></td><td>${esc(w.notes||'-')}</td><td class="row-actions"><button onclick="editWorker(${w.id})">تعديل</button><button class="light" onclick="toggleWorkerStatus(${w.id})">${w.status==='inactive'?'تفعيل':'إيقاف'}</button><button class="danger" onclick="deleteRow('workers',${w.id})">حذف</button></td></tr>`).join('')||'<tr><td colspan="9">لا توجد بيانات</td></tr>';
}
function editWorker(id){
  const w=data.workers.find(x=>x.id===id); if(!w)return;
  $('workerId').value=w.id; $('workerName').value=w.name||''; $('workerPhone').value=w.phone||''; $('workerSalary').value=w.salary||1500;
  $('workerSupervisor').value=workerSupId(w)||''; onWorkerSupervisorChange();
  if($('workerProject')) $('workerProject').value=workerProjectId(w)||'';
  if($('workerType')) $('workerType').value=w.worker_type||'primary';
  $('workerStatus').value=w.status||'active'; $('workerNotes').value=w.notes||'';
  $('workerFormTitle').textContent='تعديل عامل';
  $('workerSaveBtn')&&($('workerSaveBtn').textContent='تحديث العامل');
  $('workerCancelBtn')&&$('workerCancelBtn').classList.remove('hidden');
  showPage('workers', document.querySelector('.nav[onclick*="workers"]'));
  window.scrollTo({top:0,behavior:'smooth'});
}
async function toggleWorkerStatus(id){
  const w=data.workers.find(x=>x.id===id); if(!w) return;
  const next=w.status==='inactive'?'active':'inactive';
  const {error}=await sb.from('workers').update({status:next}).eq('id',id);
  if(error) return msg(error.message,'err');
  msg(next==='active'?'تم تفعيل العامل':'تم إيقاف العامل');
  await refreshAll();
}
function clearAttendanceForm(){ ['attendanceId','attendanceNotes'].forEach(id=>$(id)&&($(id).value='')); if($('attendanceDate')) $('attendanceDate').value=today(); if($('attendanceStatus')) $('attendanceStatus').value='present'; $('attendanceFormTitle')&&($('attendanceFormTitle').textContent='تسجيل حضور / غياب'); }
async function saveAttendance(){ const id=$('attendanceId').value; const row={attendance_date:$('attendanceDate').value||today(), worker_id:Number($('attendanceWorker').value), supervisor_id:Number($('attendanceSupervisor').value)||null, project_id:Number($('attendanceProject').value)||null, status:$('attendanceStatus').value, notes:$('attendanceNotes').value, created_by:session()?.id||null}; if(!row.worker_id) return msg('اختر العامل','err'); const res=id?await sb.from('attendance').update(row).eq('id',id):await sb.from('attendance').upsert(row,{onConflict:'attendance_date,worker_id'}); if(res.error) return msg(res.error.message,'err'); msg('تم حفظ الحضور'); clearAttendanceForm(); await refreshAll(); }
function renderAttendance(){ const b=$('attendanceBody'); if(!b) return; const d=$('attendanceFilterDate')?.value, s=$('attendanceFilterSupervisor')?.value, q=($('attendanceSearch')?.value||'').trim(); let rows=data.attendance; if(d) rows=rows.filter(a=>a.attendance_date===d); if(s) rows=rows.filter(a=>String(a.supervisor_id)===String(s)); if(q) rows=rows.filter(a=>[workerName(a.worker_id),supervisorName(a.supervisor_id),projectName(a.project_id),a.notes].join(' ').includes(q)); b.innerHTML=rows.map(a=>`<tr><td>${a.attendance_date}</td><td>${esc(workerName(a.worker_id))}</td><td>${esc(supervisorName(a.supervisor_id))}</td><td>${esc(projectName(a.project_id))}</td><td><span class="badge ${a.status==='present'?'green':'red'}">${a.status==='present'?'حاضر':'غائب'}</span></td><td>${esc(a.notes)}</td><td class="row-actions"><button onclick="editAttendance(${a.id})">تعديل</button><button class="danger" onclick="deleteRow('attendance',${a.id})">حذف</button></td></tr>`).join('')||'<tr><td colspan="7">لا توجد بيانات</td></tr>'; renderAttendanceWorkersQuick(); }
function editAttendance(id){ const a=data.attendance.find(x=>x.id===id); if(!a)return; $('attendanceId').value=a.id; $('attendanceDate').value=a.attendance_date; $('attendanceSupervisor').value=a.supervisor_id||''; $('attendanceProject').value=a.project_id||''; $('attendanceWorker').value=a.worker_id||''; $('attendanceStatus').value=a.status; $('attendanceNotes').value=a.notes||''; $('attendanceFormTitle').textContent='تعديل حضور'; }
function renderAttendanceWorkersQuick(){ const div=$('attendanceQuick'); if(!div) return; const sid=$('attendanceSupervisor')?.value; if(!sid){ div.innerHTML=''; return; } const ws=data.workers.filter(w=>String(workerSupId(w))===String(sid)); div.innerHTML=ws.map(w=>`<div class="quick-item"><b>${esc(w.name)}</b><div><button onclick="quickAttendance(${w.id},'present')">حاضر</button> <button class="danger" onclick="quickAttendance(${w.id},'absent')">غائب</button></div></div>`).join(''); }
async function quickAttendance(workerId,status){ $('attendanceWorker').value=workerId; $('attendanceStatus').value=status; await saveAttendance(); }
function renderMonthly(){
  const body=$('monthlyBody');
  if(!body) return;
  const month=$('monthlyMonth')?.value || today().slice(0,7);
  const sid=$('monthlySupervisor')?.value;
  let rows=data.logs.filter(l=>{
    const d = l.log_date || String(l.check_in||'').slice(0,10);
    return d.slice(0,7)===month;
  });
  if(sid) rows=rows.filter(l=>String(l.supervisor_id)===String(sid));
  const map={};
  rows.forEach(l=>{
    const k=(l.supervisor_id||'')+'_'+(l.project_id||'');
    if(!map[k]) map[k]={s:l.supervisor_id,p:l.project_id,c:0,m:0,req:0,t:0};
    const actual = logActualMinutes(l);
    const required = logRequiredMinutes(l);
    map[k].c++;
    map[k].m += actual;
    map[k].req += required;
    map[k].t += Number(l.travel_minutes||0);
  });
  const vals=Object.values(map).map(r=>{
    r.percent = r.req ? (r.m/r.req)*100 : 0;
    r.perf = performanceStatus(r.percent,r.req);
    return r;
  });
  body.innerHTML=vals.map(r=>`<tr><td>${esc(supervisorName(r.s))}</td><td>${esc(projectName(r.p))}</td><td>${r.c}</td><td>${minsToText(r.req)}</td><td>${minsToText(r.m)}</td><td>${r.t} دقيقة</td><td><span class="badge ${r.perf.cls}">${percentText(r.percent)}</span></td><td><span class="badge ${r.perf.cls}">${r.perf.text}</span></td></tr>`).join('')||'<tr><td colspan="8">لا توجد بيانات</td></tr>';
  const total=vals.reduce((a,r)=>a+r.m,0), required=vals.reduce((a,r)=>a+r.req,0), travel=vals.reduce((a,r)=>a+r.t,0), pct=required?total/required*100:0;
  const perf=performanceStatus(pct,required);
  if($('monthlySummary')) $('monthlySummary').innerHTML=`<div class="kpi"><small>عدد التسجيلات</small><b>${rows.length}</b></div><div class="kpi"><small>الساعات المطلوبة</small><b>${minsToText(required)}</b></div><div class="kpi"><small>الساعات الفعلية</small><b>${minsToText(total)}</b></div><div class="kpi"><small>وقت الانتقال</small><b>${travel} دقيقة</b></div><div class="kpi"><small>نسبة العمل</small><b>${percentText(pct)}</b></div><div class="kpi"><small>حالة الأداء</small><b><span class="badge ${perf.cls}">${perf.text}</span></b></div>`;
}
function clearTicketForm(){ ['ticketId','ticketTitle','ticketDescription'].forEach(id=>$(id)&&($(id).value='')); if($('ticketStatus')) $('ticketStatus').value='open'; if($('ticketPriority')) $('ticketPriority').value='normal'; $('ticketFormTitle')&&($('ticketFormTitle').textContent='إضافة تكت'); }
async function saveTicket(){ const u=session(); const row={project_id:Number($('ticketProject').value)||null, supervisor_id:Number($('ticketSupervisor')?.value || (u.role==='supervisor'?u.id:''))||null, title:$('ticketTitle').value.trim(), description:$('ticketDescription').value, priority:$('ticketPriority').value, status:$('ticketStatus')?.value || 'open'}; if(!row.title) return msg('عنوان التكت مطلوب','err'); if(row.status==='closed') row.closed_at=new Date().toISOString(); const id=$('ticketId')?.value; const res=id?await sb.from('tickets').update(row).eq('id',id):await sb.from('tickets').insert(row); if(res.error) return msg(res.error.message,'err'); playAppSound('ticket'); msg('تم حفظ التكت'); clearTicketForm(); await refreshAll(); }
function renderTickets(){ const b=$('ticketsBody'); if(!b) return; const st=$('ticketFilterStatus')?.value, q=($('ticketSearch')?.value||'').trim(); let rows=data.tickets; if(st) rows=rows.filter(t=>t.status===st); if(q) rows=rows.filter(t=>[t.title,t.description,projectName(t.project_id),supervisorName(t.supervisor_id)].join(' ').includes(q)); b.innerHTML=rows.map(t=>`<tr><td>${esc(projectName(t.project_id))}</td><td>${esc(supervisorName(t.supervisor_id))}</td><td>${esc(t.title)}</td><td><span class="badge ${t.priority==='high'?'red':'amber'}">${t.priority||'normal'}</span></td><td><span class="badge ${t.status==='closed'?'green':'red'}">${t.status==='closed'?'مغلق':'مفتوح'}</span></td><td class="row-actions"><button onclick="editTicket(${t.id})">تعديل</button><button class="danger" onclick="deleteRow('tickets',${t.id})">حذف</button></td></tr>`).join('')||'<tr><td colspan="6">لا توجد بيانات</td></tr>'; }
function editTicket(id){ const t=data.tickets.find(x=>x.id===id); if(!t)return; $('ticketId').value=t.id; $('ticketProject').value=t.project_id||''; if($('ticketSupervisor')) $('ticketSupervisor').value=t.supervisor_id||''; $('ticketTitle').value=t.title||''; $('ticketPriority').value=t.priority||'normal'; if($('ticketStatus')) $('ticketStatus').value=t.status||'open'; $('ticketDescription').value=t.description||''; $('ticketFormTitle')&&($('ticketFormTitle').textContent='تعديل تكت'); }
function renderAlerts(){ const div=$('alertsList'); if(!div) return; const alerts=[]; data.projects.filter(p=>!p.supervisor_id).forEach(p=>alerts.push(['warn',`مشروع بدون مشرف: ${p.name}`])); data.workers.filter(w=>!workerSupId(w)).forEach(w=>alerts.push(['warn',`عامل بدون مشرف: ${w.name}`])); data.logs.filter(l=>!l.check_out).forEach(l=>alerts.push(['danger',`تسجيل دخول بدون خروج: ${projectName(l.project_id)} - ${supervisorName(l.supervisor_id)}`])); data.tickets.filter(t=>t.status==='open').forEach(t=>alerts.push(['warn',`تكت مفتوح: ${t.title} - ${projectName(t.project_id)}`])); div.innerHTML=alerts.map(a=>`<div class="alert-item ${a[0]}">${esc(a[1])}</div>`).join('')||'<div class="alert-item">لا توجد تنبيهات حالياً</div>'; }
function toCSV(rows){ if(!rows.length) return ''; const keys=Object.keys(rows[0]); return [keys.join(','),...rows.map(r=>keys.map(k=>'"'+String(r[k]??'').replace(/"/g,'""')+'"').join(','))].join('\n'); }
function download(name,text){ const blob=new Blob([text],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); URL.revokeObjectURL(a.href); }
async function exportTable(table){ const {data:rows,error}=await sb.from(table).select('*'); if(error) return msg(error.message,'err'); download(`${table}.csv`, toCSV(rows||[])); }
function exportMonthlyCSV(){ const rows=[...document.querySelectorAll('#monthlyBody tr')].map(tr=>[...tr.children].map(td=>td.textContent)); const csv=['المشرف,المشروع,عدد السجلات,الساعات المطلوبة,الساعات الفعلية,وقت الانتقال,نسبة العمل,حالة الأداء',...rows.map(r=>r.map(x=>'"'+x+'"').join(','))].join('\n'); download('monthly.csv',csv); }
async function initSupervisor(){ const u=requireRole('supervisor'); if(!u) return; await loadAll(); data.projects=data.projects.filter(p=>String(p.supervisor_id)===String(u.id)); data.workers=data.workers.filter(w=>String(workerSupId(w))===String(u.id)); data.logs=data.logs.filter(l=>String(l.supervisor_id)===String(u.id)); const supProjectIds = new Set(data.projects.map(p=>String(p.id))); data.tickets=data.tickets.filter(t=>String(t.supervisor_id)===String(u.id) || String(t.created_by)===String(u.id) || supProjectIds.has(String(t.project_id))); $('supTitle').textContent=`لوحة المشرف - ${u.full_name}`; fillSelect('logProject',data.projects,'name','اختر المشروع'); fillSelect('attendanceProject',data.projects,'name','اختر المشروع'); fillSelect('ticketProject',data.projects,'name','اختر المشروع'); if($('logDate')) $('logDate').value=today(); if($('attendanceDate')) $('attendanceDate').value=today(); renderSupervisorAttendanceList(); renderTimeLogs(); }
async function supervisorCheckIn(){
  if(!$('logProject').value) return msg('اختر المشروع','err');
  prepareWhatsappPopupV63();
  $('logDate').value=today();
  $('logIn').value=nowTime();
  $('logOut').value='';
  await saveTimeLog();
  await initSupervisor();
}
async function supervisorCheckOut(){
  const u=session();
  const pid=$('logProject').value;
  const date=$('logDate')?.value||today();
  if(!pid) return msg('اختر المشروع','err');
  prepareWhatsappPopupV63();
  const open=data.logs.find(l=>String(l.project_id)===String(pid)&&String(l.supervisor_id)===String(u.id)&&!l.check_out&&(l.log_date||String(l.check_in||'').slice(0,10))===date);
  if(open) editTimeLog(open.id);
  $('logOut').value=nowTime();
  await saveTimeLog();
  await initSupervisor();
}
function renderSupervisorAttendanceList(){ const div=$('supervisorAttendanceList'); if(!div) return; div.innerHTML=data.workers.map(w=>`<div class="quick-item"><b>${esc(w.name)}</b><select data-worker="${w.id}"><option value="present">حاضر</option><option value="absent">غائب</option></select></div>`).join('')||'<div class="quick-item">لا يوجد عمال مرتبطين بك</div>'; }
async function saveSupervisorAttendance(){ const u=session(); const date=$('attendanceDate').value||today(), project=Number($('attendanceProject').value)||null; const rows=[...document.querySelectorAll('#supervisorAttendanceList select')].map(s=>({attendance_date:date, worker_id:Number(s.dataset.worker), supervisor_id:u.id, project_id:project, status:s.value, created_by:u.id})); if(!rows.length) return; const {error}=await sb.from('attendance').upsert(rows,{onConflict:'attendance_date,worker_id'}); if(error) return msg(error.message,'err'); msg('تم حفظ التحضير'); await initSupervisor(); }

/* ===== Tasneef emergency navigation/button stabilizer ===== */
(function(){
  function runSafe(name){
    try { if (typeof window[name] === 'function') window[name](); }
    catch(e){ console.error('Error in '+name, e); }
  }

  const renderNames = ['renderDashboard','renderTimeLogs','renderUsers','renderProjects','renderWorkers','renderAttendance','renderMonthly','renderTickets','renderAlerts'];
  window.renderAll = function(){ renderNames.forEach(runSafe); };

  window.showPage = function(id, btn){
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const page = document.getElementById(id);
    if(page) page.classList.remove('hidden');
    document.querySelectorAll('.nav').forEach(n => n.classList.remove('active'));
    if(btn) btn.classList.add('active');
    try { window.renderAll(); } catch(e){ console.error('renderAll failed', e); }
  };

  const oldInitAdmin = window.initAdmin;
  window.initAdmin = async function(){
    try {
      if (typeof requireRole === 'function') requireRole('admin');
      if (typeof refreshAll === 'function') await refreshAll();
    } catch(e){
      console.error('initAdmin failed', e);
      try { window.renderAll(); } catch(_e){}
    }
  };

  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('.side .nav:not(.danger)').forEach(function(btn){
      const txt = (btn.textContent || '').trim();
      const map = {
        'لوحة التحكم':'dashboard',
        'التسجيلات اليومية':'daily',
        'إدارة المستخدمين':'users',
        'المشاريع':'projects',
        'العمال':'workers',
        'الحضور والغياب':'attendance',
        'الأوقات الشهرية':'monthly',
        'التكتات':'tickets',
        'التنبيهات':'alerts',
        'التصدير':'export'
      };
      const old = btn.getAttribute('onclick') || '';
      const m = old.match(/showPage\('([^']+)'/);
      const id = (m && m[1]) || map[txt];
      if(id){
        btn.onclick = function(ev){ ev.preventDefault(); window.showPage(id, btn); return false; };
      }
    });
  });
})();

/* ===== V10: Monthly attendance matrix ===== */
(function(){
  function daysInMonth(monthStr){
    if(!monthStr || !monthStr.includes('-')) monthStr = today().slice(0,7);
    const parts = monthStr.split('-').map(Number);
    return new Date(parts[0], parts[1], 0).getDate();
  }
  function monthDate(monthStr, day){ return monthStr + '-' + String(day).padStart(2,'0'); }
  function setSelectOptionsSafe(id, rows, labelFn, allLabel){
    const el = $(id); if(!el) return;
    const old = el.value;
    el.innerHTML = `<option value="">${allLabel||'الكل'}</option>` + rows.map(r=>`<option value="${r.id}">${esc(labelFn(r))}</option>`).join('');
    if([...el.options].some(o=>o.value===old)) el.value = old;
  }
  function ensureAttendanceMatrixFilters(){
    const monthEl = $('attendanceMatrixMonth');
    if(monthEl && !monthEl.value) monthEl.value = today().slice(0,7);
    setSelectOptionsSafe('attendanceMatrixSupervisor', data.supervisors||[], s=>s.full_name||s.username, 'كل المشرفين');
    const sid = $('attendanceMatrixSupervisor')?.value;
    let projects = data.projects || [];
    if(sid) projects = projects.filter(p=>String(p.supervisor_id)===String(sid));
    setSelectOptionsSafe('attendanceMatrixProject', projects, p=>p.name, 'كل المشاريع');
  }
  function workerMatchesMatrix(w, sid, pid, q){
    if(sid && String(workerSupId(w))!==String(sid)) return false;
    if(pid && String(workerProjectId(w))!==String(pid)) return false;
    if(q && !String(w.name||'').includes(q)) return false;
    return true;
  }
  window.renderAttendanceMonthly = function(){
    if(!$('attendanceMatrixBody')) return;
    ensureAttendanceMatrixFilters();
    const month = $('attendanceMatrixMonth')?.value || today().slice(0,7);
    const sid = $('attendanceMatrixSupervisor')?.value || '';
    const pid = $('attendanceMatrixProject')?.value || '';
    const q = ($('attendanceMatrixSearch')?.value || '').trim();
    const days = daysInMonth(month);
    const workers = (data.workers||[]).filter(w=>workerMatchesMatrix(w,sid,pid,q));
    const head = $('attendanceMatrixHead');
    if(head){
      const dayHeads = Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
      head.innerHTML = `<tr><th>العامل</th><th>المشرف</th><th>المشروع</th>${dayHeads}<th>حضور</th><th>غياب</th><th>النسبة</th></tr>`;
    }
    let totalPresent=0,totalAbsent=0;
    const body = $('attendanceMatrixBody');
    body.innerHTML = workers.map(w=>{
      let present=0, absent=0;
      const cells = [];
      for(let d=1; d<=days; d++){
        const ds = monthDate(month,d);
        const rec = (data.attendance||[]).find(a=>String(a.worker_id)===String(w.id) && a.attendance_date===ds && (!pid || String(a.project_id||workerProjectId(w))===String(pid)));
        if(rec?.status==='present'){ present++; cells.push(`<td title="حاضر"><span class="att-cell att-present">ح</span></td>`); }
        else if(rec?.status==='absent'){ absent++; cells.push(`<td title="غائب"><span class="att-cell att-absent">غ</span></td>`); }
        else cells.push(`<td title="لم يسجل"><span class="att-cell att-empty">-</span></td>`);
      }
      totalPresent += present; totalAbsent += absent;
      const pct = (present+absent) ? (present/(present+absent))*100 : 0;
      const cls = pct>=90?'green':(pct>=70?'amber':'red');
      return `<tr><td><b>${esc(w.name)}</b><div class="att-summary">${esc(workerTypeText(w.worker_type||'primary'))}</div></td><td>${esc(supervisorName(workerSupId(w)))}</td><td>${esc(projectName(workerProjectId(w)))}</td>${cells.join('')}<td><span class="badge green">${present}</span></td><td><span class="badge red">${absent}</span></td><td><span class="badge ${cls}">${pct.toFixed(1)}%</span></td></tr>`;
    }).join('') || `<tr><td colspan="${days+6}">لا يوجد عمال حسب الفلاتر المختارة</td></tr>`;
    const recorded = totalPresent + totalAbsent;
    const pct = recorded ? (totalPresent/recorded)*100 : 0;
    if($('attendanceMatrixSummary')){
      $('attendanceMatrixSummary').innerHTML = `<div class="kpi"><small>عدد العمال</small><b>${workers.length}</b></div><div class="kpi"><small>إجمالي الحضور</small><b>${totalPresent}</b></div><div class="kpi"><small>إجمالي الغياب</small><b>${totalAbsent}</b></div><div class="kpi"><small>نسبة الحضور</small><b>${pct.toFixed(1)}%</b></div>`;
    }
  };
  window.exportAttendanceMatrixCSV = function(){
    const month = $('attendanceMatrixMonth')?.value || today().slice(0,7);
    const rows=[...document.querySelectorAll('#attendanceMatrixBody tr')].map(tr=>[...tr.children].map(td=>`"${td.textContent.trim().replace(/"/g,'""')}"`).join(','));
    const heads=[...document.querySelectorAll('#attendanceMatrixHead th')].map(th=>`"${th.textContent.trim()}"`).join(',');
    download(`attendance-${month}.csv`, [heads,...rows].join('\n'));
  };
  const oldRenderAttendance = window.renderAttendance;
  window.renderAttendance = function(){
    try{ if(typeof oldRenderAttendance==='function') oldRenderAttendance(); }catch(e){ console.error('old renderAttendance failed',e); }
    try{ window.renderAttendanceMonthly(); }catch(e){ console.error('renderAttendanceMonthly failed',e); }
  };
})();

/* ===== V10.1: Fix attendance monthly filters and empty results ===== */
(function(){
  function daysInMonthFixed(monthStr){
    if(!monthStr || !monthStr.includes('-')) monthStr = today().slice(0,7);
    const [y,m] = monthStr.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }
  function monthDateFixed(monthStr, day){ return `${monthStr}-${String(day).padStart(2,'0')}`; }
  function monthOfAttendance(a){ return String(a.attendance_date || '').slice(0,7); }
  function safeOptionText(v){ return esc(v || '-'); }
  function setOptionsKeepValue(id, rows, labelFn, allLabel){
    const el = $(id); if(!el) return '';
    const old = el.value || '';
    const seen = new Set();
    const opts = [];
    (rows||[]).forEach(r=>{
      if(!r || r.id===undefined || r.id===null) return;
      const val = String(r.id);
      if(seen.has(val)) return;
      seen.add(val);
      opts.push(`<option value="${esc(val)}">${safeOptionText(labelFn(r))}</option>`);
    });
    el.innerHTML = `<option value="">${allLabel || 'الكل'}</option>` + opts.join('');
    if([...el.options].some(o=>o.value===old)) el.value = old;
    else el.value = '';
    return el.value;
  }
  function projectMatchesSupervisorForAttendance(project, sid, month){
    if(!sid) return true;
    if(String(project.supervisor_id||'') === String(sid)) return true;
    const hasWorker = (data.workers||[]).some(w => String(workerProjectId(w)||'')===String(project.id) && String(workerSupId(w)||'')===String(sid));
    if(hasWorker) return true;
    return (data.attendance||[]).some(a => monthOfAttendance(a)===month && String(a.project_id||'')===String(project.id) && String(a.supervisor_id||'')===String(sid));
  }
  function workerMatchesAttendanceMatrixFixed(w, sid, pid, q, month){
    const wid = String(w.id);
    const wsid = String(workerSupId(w)||'');
    const wpid = String(workerProjectId(w)||'');
    const workerAttend = (data.attendance||[]).filter(a=>monthOfAttendance(a)===month && String(a.worker_id)===wid);
    if(sid){
      const projectSupervisorMatch = wpid && String((data.projects||[]).find(p=>String(p.id)===wpid)?.supervisor_id||'')===String(sid);
      const attendanceSupervisorMatch = workerAttend.some(a=>String(a.supervisor_id||'')===String(sid));
      if(wsid!==String(sid) && !projectSupervisorMatch && !attendanceSupervisorMatch) return false;
    }
    if(pid){
      const attendanceProjectMatch = workerAttend.some(a=>String(a.project_id||'')===String(pid));
      if(wpid!==String(pid) && !attendanceProjectMatch) return false;
    }
    if(q && !String(w.name||'').includes(q)) return false;
    return true;
  }
  function recordForDay(w, ds, sid, pid){
    const rows = (data.attendance||[]).filter(a=>String(a.worker_id)===String(w.id) && a.attendance_date===ds);
    return rows.find(a=>(!sid || String(a.supervisor_id||workerSupId(w)||'')===String(sid)) && (!pid || String(a.project_id||workerProjectId(w)||'')===String(pid))) || null;
  }
  window.renderAttendanceMonthly = function(){
    const body = $('attendanceMatrixBody');
    if(!body) return;

    const monthEl = $('attendanceMatrixMonth');
    if(monthEl && !monthEl.value) monthEl.value = today().slice(0,7);
    const month = monthEl?.value || today().slice(0,7);

    const supervisorRows = (data.supervisors && data.supervisors.length ? data.supervisors : (data.users||[]).filter(u=>u.role==='supervisor'));
    const sid = setOptionsKeepValue('attendanceMatrixSupervisor', supervisorRows, s=>s.full_name || s.username, 'كل المشرفين');

    const projectRows = (data.projects||[]).filter(p=>projectMatchesSupervisorForAttendance(p, sid, month));
    const pid = setOptionsKeepValue('attendanceMatrixProject', projectRows, p=>p.name, 'كل المشاريع');

    const q = ($('attendanceMatrixSearch')?.value || '').trim();
    const days = daysInMonthFixed(month);
    const workers = (data.workers||[]).filter(w=>workerMatchesAttendanceMatrixFixed(w, sid, pid, q, month));

    const head = $('attendanceMatrixHead');
    if(head){
      const dayHeads = Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
      head.innerHTML = `<tr><th>العامل</th><th>المشرف</th><th>المشروع</th>${dayHeads}<th>حضور</th><th>غياب</th><th>النسبة</th></tr>`;
    }

    let totalPresent=0, totalAbsent=0;
    body.innerHTML = workers.map(w=>{
      let present=0, absent=0;
      const cells=[];
      for(let d=1; d<=days; d++){
        const ds = monthDateFixed(month,d);
        const rec = recordForDay(w, ds, sid, pid);
        if(rec && rec.status==='present'){
          present++; cells.push(`<td title="حاضر"><span class="att-cell att-present">ح</span></td>`);
        } else if(rec && rec.status==='absent'){
          absent++; cells.push(`<td title="غائب"><span class="att-cell att-absent">غ</span></td>`);
        } else {
          cells.push(`<td title="لم يسجل"><span class="att-cell att-empty">-</span></td>`);
        }
      }
      totalPresent += present; totalAbsent += absent;
      const pct = (present+absent) ? (present/(present+absent))*100 : 0;
      const cls = pct>=90 ? 'green' : (pct>=70 ? 'amber' : 'red');
      const projectId = pid || workerProjectId(w);
      const supervisorId = sid || workerSupId(w) || (projectId ? (data.projects||[]).find(p=>String(p.id)===String(projectId))?.supervisor_id : '');
      return `<tr><td><b>${esc(w.name)}</b><div class="att-summary">${esc(workerTypeText(w.worker_type||'primary'))}</div></td><td>${esc(supervisorName(supervisorId))}</td><td>${esc(projectName(projectId))}</td>${cells.join('')}<td><span class="badge green">${present}</span></td><td><span class="badge red">${absent}</span></td><td><span class="badge ${cls}">${pct.toFixed(1)}%</span></td></tr>`;
    }).join('') || `<tr><td colspan="${days+6}">لا يوجد عمال حسب الفلاتر المختارة</td></tr>`;

    const recorded = totalPresent + totalAbsent;
    const pct = recorded ? (totalPresent/recorded)*100 : 0;
    if($('attendanceMatrixSummary')){
      $('attendanceMatrixSummary').innerHTML = `<div class="kpi"><small>عدد العمال</small><b>${workers.length}</b></div><div class="kpi"><small>إجمالي الحضور</small><b>${totalPresent}</b></div><div class="kpi"><small>إجمالي الغياب</small><b>${totalAbsent}</b></div><div class="kpi"><small>نسبة الحضور</small><b>${pct.toFixed(1)}%</b></div>`;
    }
  };

  const oldShowPageV101 = window.showPage;
  window.showPage = function(id, btn){
    if(typeof oldShowPageV101 === 'function') oldShowPageV101(id, btn);
    if(id === 'attendance') setTimeout(()=>window.renderAttendanceMonthly && window.renderAttendanceMonthly(), 0);
  };
})();


/* ===== V14: Ticket receiving, closing details, duration and colors ===== */
(function(){
  function ticketNo(t){ return t.ticket_number || ('T-' + String(t.id||0).padStart(4,'0')); }
  function ticketStatusLabel(status){ return status==='closed'?'مغلق':(status==='processing'?'تحت المعالجة':'مفتوح'); }
  function ticketPriorityLabel(p){ return p==='urgent'?'عاجل':(p==='high'?'مهم':(p==='low'?'منخفض':'عادي')); }
  function shortDesc(s){ s=String(s||''); return s.length>90 ? esc(s.slice(0,90))+'…' : esc(s||'-'); }
  function currentName(){ const u=session(); return (u && (u.full_name || u.username)) || 'غير محدد'; }
  function parseDate(v){ const d = v ? new Date(v) : null; return d && !isNaN(d) ? d : null; }
  function minutesBetween(a,b){ const da=parseDate(a), db=parseDate(b); if(!da || !db) return 0; return Math.max(0, Math.round((db-da)/60000)); }
  function durationLabel(min){ min=Number(min||0); if(!min) return '0د'; const d=Math.floor(min/1440), h=Math.floor((min%1440)/60), m=min%60; const parts=[]; if(d) parts.push(d+'ي'); if(h) parts.push(h+'س'); if(m||!parts.length) parts.push(m+'د'); return parts.join(' '); }
  function openMinutes(t){ if(t.status==='closed') return Number(t.open_duration_minutes||0) || minutesBetween(t.created_at, t.closed_at); return minutesBetween(t.created_at, new Date().toISOString()); }
  function ticketRowClass(t){ if(t.status==='closed') return 'ticket-row-closed'; if(t.status==='processing') return 'ticket-row-processing'; if(t.priority==='urgent'||t.priority==='high') return 'ticket-row-urgent'; return 'ticket-row-normal'; }
  function statusBadge(t){ const cls=t.status==='closed'?'green':(t.status==='processing'?'amber':((t.priority==='urgent'||t.priority==='high')?'red':'pink')); return `<span class="badge ${cls}">${ticketStatusLabel(t.status)}</span>`; }
  function priorityBadge(t){ const cls=t.priority==='urgent'?'red':(t.priority==='high'?'amber':'pink'); return `<span class="badge ${cls}">${ticketPriorityLabel(t.priority)}</span>`; }
  function askCloserName(){ const name=prompt('اسم الشخص الذي أغلق التكت\nاكتب اسم الفني أو المشرف', currentName()); return (name||'').trim(); }
  function askClosureNote(){ const note=prompt('كيف تم إغلاق التكت؟\nاكتب طريقة الحل أو الإجراء المنفذ'); return (note||'').trim(); }

  window.toggleTicketClosureBox = function(){
    const box=$('ticketClosureBox'); if(!box) return;
    const isClosed=($('ticketStatus')?.value||'')==='closed';
    box.classList.toggle('hidden', !isClosed);
    if(isClosed && $('ticketClosedByName') && !$('ticketClosedByName').value) $('ticketClosedByName').value=currentName();
  };

  window.clearTicketForm = function(){ ['ticketId','ticketTitle','ticketDescription','ticketClosureNote','ticketClosedByName'].forEach(id=>{ if($(id)) $(id).value=''; }); if($('ticketStatus')) $('ticketStatus').value='open'; if($('ticketPriority')) $('ticketPriority').value='normal'; if($('ticketFormTitle')) $('ticketFormTitle').textContent='إضافة تكت'; toggleTicketClosureBox(); };

  window.saveTicket = async function(){
    const u=session(); if(!u) return msg('سجّل الدخول أولاً','err');
    const title=($('ticketTitle')?.value||'').trim(); if(!title) return msg('عنوان التكت مطلوب','err');
    const status=$('ticketStatus')?.value || 'open';
    const row={project_id:Number($('ticketProject')?.value)||null, supervisor_id:Number($('ticketSupervisor')?.value || (u.role==='supervisor'?u.id:''))||null, created_by:u.id, title, description:$('ticketDescription')?.value || '', priority:$('ticketPriority')?.value || 'normal', status, updated_at:new Date().toISOString()};
    const id=$('ticketId')?.value;
    if(status==='closed'){
      const existing=id?(data.tickets||[]).find(x=>String(x.id)===String(id)):null;
      const note=(($('ticketClosureNote')?.value)||'').trim() || askClosureNote(); if(!note) return msg('لا يمكن إغلاق التكت بدون ذكر كيف تم الإغلاق','err');
      const closer=(($('ticketClosedByName')?.value)||'').trim() || askCloserName(); if(!closer) return msg('اكتب اسم من أغلق التكت','err');
      const now=new Date().toISOString(); row.closed_at=now; row.closed_by=u.id; row.closed_by_name=closer; row.closure_note=note; row.open_duration_minutes=existing?minutesBetween(existing.created_at,now):0; row.processing_duration_minutes=existing?.claimed_at?minutesBetween(existing.claimed_at,now):0;
      if(existing && !existing.claimed_at){ row.claimed_by=u.id; row.claimed_by_name=closer; row.claimed_at=now; }
    }else{ row.closed_at=null; row.closed_by=null; row.closed_by_name=null; row.closure_note=null; row.open_duration_minutes=null; row.processing_duration_minutes=null; }
    let res; if(id){ res=await sb.from('tickets').update(row).eq('id',id).select('*').maybeSingle(); }else{ res=await sb.from('tickets').insert(row).select('*').single(); if(!res.error&&res.data&&!res.data.ticket_number){ const tn='T-'+String(res.data.id).padStart(4,'0'); await sb.from('tickets').update({ticket_number:tn}).eq('id',res.data.id); } }
    if(res.error) return msg(res.error.message,'err'); playAppSound('ticket'); msg(id?'تم تحديث التكت':'تم حفظ التكت'); clearTicketForm(); if(u.role==='supervisor') await window.initSupervisor(); else await refreshAll();
  };

  window.renderTickets = function(){
    const adminBody=$('ticketsBody'), supBody=$('supTicketsBody'); if(!adminBody&&!supBody) return; let rows=[...(data.tickets||[])];
    if(adminBody){ const st=$('ticketFilterStatus')?.value||'', q=($('ticketSearch')?.value||'').trim().toLowerCase(); let list=rows; if(st) list=list.filter(t=>t.status===st); if(q) list=list.filter(t=>[ticketNo(t),t.title,t.description,projectName(t.project_id),supervisorName(t.supervisor_id),ticketStatusLabel(t.status),t.claimed_by_name,t.closed_by_name,t.closure_note].join(' ').toLowerCase().includes(q)); adminBody.innerHTML=list.map(t=>`<tr class="${ticketRowClass(t)}"><td><b>${esc(ticketNo(t))}</b></td><td>${esc(projectName(t.project_id))}</td><td>${esc(supervisorName(t.supervisor_id))}</td><td>${esc(t.title)}</td><td style="white-space:normal;min-width:220px">${shortDesc(t.description)}</td><td>${priorityBadge(t)}</td><td>${statusBadge(t)}</td><td>${fmt(t.created_at)}</td><td>${esc(durationLabel(openMinutes(t)))}</td><td>${esc(t.claimed_by_name||'-')}<br><small>${t.claimed_at?fmt(t.claimed_at):''}</small></td><td>${esc(t.closed_by_name||'-')}<br><small>${t.closed_at?fmt(t.closed_at):''}</small></td><td style="white-space:normal;min-width:220px">${shortDesc(t.closure_note)}</td><td class="row-actions"><button onclick="editTicket(${t.id})">تعديل</button>${t.status==='closed'?`<button class="light" onclick="setTicketStatus(${t.id},'open')">إعادة فتح</button>`:`${t.status!=='processing'?`<button class="light" onclick="claimTicket(${t.id})">استلام</button>`:''}<button onclick="closeTicket(${t.id})">إغلاق</button>`}<button class="danger" onclick="deleteRow('tickets',${t.id})">حذف</button></td></tr>`).join('')||'<tr><td colspan="13">لا توجد تكتات</td></tr>'; }
    if(supBody){ const st=$('supTicketFilterStatus')?.value||'', pid=$('supTicketFilterProject')?.value||'', q=($('supTicketSearch')?.value||'').trim().toLowerCase(); let list=rows; if(pid) list=list.filter(t=>String(t.project_id)===String(pid)); if(st) list=list.filter(t=>t.status===st); if(q) list=list.filter(t=>[ticketNo(t),t.title,t.description,projectName(t.project_id),ticketStatusLabel(t.status),t.claimed_by_name,t.closed_by_name,t.closure_note].join(' ').toLowerCase().includes(q)); supBody.innerHTML=list.map(t=>`<tr class="${ticketRowClass(t)}"><td><b>${esc(ticketNo(t))}</b></td><td>${esc(projectName(t.project_id))}</td><td>${esc(t.title)}</td><td style="white-space:normal;min-width:180px">${shortDesc(t.description)}</td><td>${priorityBadge(t)}</td><td>${statusBadge(t)}</td><td>${esc(durationLabel(openMinutes(t)))}</td><td>${esc(t.claimed_by_name||'-')}</td><td>${esc(t.closed_by_name||'-')}</td><td style="white-space:normal;min-width:180px">${shortDesc(t.closure_note)}</td><td class="row-actions"><button onclick="editTicket(${t.id})">تعديل</button>${t.status==='closed'?`<button class="light" onclick="setTicketStatus(${t.id},'open')">إعادة فتح</button>`:`${t.status!=='processing'?`<button class="light" onclick="claimTicket(${t.id})">استلام</button>`:''}<button onclick="closeTicket(${t.id})">إغلاق</button>`}</td></tr>`).join('')||'<tr><td colspan="11">لا توجد تكتات</td></tr>'; }
  };

  window.editTicket = function(id){ const t=(data.tickets||[]).find(x=>String(x.id)===String(id)); if(!t)return; if($('ticketId')) $('ticketId').value=t.id; if($('ticketProject')) $('ticketProject').value=t.project_id||''; if($('ticketSupervisor')) $('ticketSupervisor').value=t.supervisor_id||''; if($('ticketTitle')) $('ticketTitle').value=t.title||''; if($('ticketPriority')) $('ticketPriority').value=t.priority||'normal'; if($('ticketStatus')) $('ticketStatus').value=t.status||'open'; if($('ticketDescription')) $('ticketDescription').value=t.description||''; if($('ticketClosedByName')) $('ticketClosedByName').value=t.closed_by_name||''; if($('ticketClosureNote')) $('ticketClosureNote').value=t.closure_note||''; if($('ticketFormTitle')) $('ticketFormTitle').textContent='تعديل تكت '+ticketNo(t); toggleTicketClosureBox(); window.scrollTo({top:0,behavior:'smooth'}); };

  window.claimTicket = async function(id){ const u=session(); if(!u)return msg('سجّل الدخول أولاً','err'); const t=(data.tickets||[]).find(x=>String(x.id)===String(id)); if(!t)return msg('التكت غير موجود','err'); if(t.status==='closed')return msg('التكت مغلق','err'); const now=new Date().toISOString(), name=currentName(); const {error}=await sb.from('tickets').update({status:'processing',claimed_by:u.id,claimed_by_name:name,claimed_at:now,updated_at:now}).eq('id',id); if(error)return msg(error.message,'err'); msg('تم استلام التكت بواسطة '+name); if(u?.role==='supervisor') await window.initSupervisor(); else await refreshAll(); };

  window.closeTicket = async function(id){ const u=session(); if(!u)return msg('سجّل الدخول أولاً','err'); const t=(data.tickets||[]).find(x=>String(x.id)===String(id)); if(!t)return msg('التكت غير موجود','err'); if(t.status==='closed')return msg('التكت مغلق بالفعل','err'); const note=askClosureNote(); if(!note)return msg('لا يمكن إغلاق التكت بدون ذكر كيف تم الإغلاق','err'); const closer=askCloserName(); if(!closer)return msg('اكتب اسم من أغلق التكت','err'); const now=new Date().toISOString(); const row={status:'closed',closed_at:now,closed_by:u.id,closed_by_name:closer,closure_note:note,open_duration_minutes:minutesBetween(t.created_at,now),processing_duration_minutes:t.claimed_at?minutesBetween(t.claimed_at,now):null,updated_at:now}; if(!t.claimed_at){ row.claimed_by=u.id; row.claimed_by_name=closer; row.claimed_at=now; } const {error}=await sb.from('tickets').update(row).eq('id',id); if(error)return msg(error.message,'err'); playAppSound('ticket'); msg('تم إغلاق التكت وحفظ طريقة الإغلاق'); if(u?.role==='supervisor') await window.initSupervisor(); else await refreshAll(); };

  window.setTicketStatus = async function(id,status){ if(status==='closed') return closeTicket(id); if(status==='processing') return claimTicket(id); const row={status,updated_at:new Date().toISOString()}; if(status==='open'){ row.closed_at=null; row.closed_by=null; row.closed_by_name=null; row.closure_note=null; row.open_duration_minutes=null; row.processing_duration_minutes=null; } const {error}=await sb.from('tickets').update(row).eq('id',id); if(error)return msg(error.message,'err'); msg(status==='open'?'تم إعادة فتح التكت':'تم تحديث حالة التكت'); const u=session(); if(u?.role==='supervisor') await window.initSupervisor(); else await refreshAll(); };

  const oldInitSupervisorV14 = window.initSupervisor;
  window.initSupervisor = async function(){ await oldInitSupervisorV14(); if($('supTicketFilterProject')) fillSelect('supTicketFilterProject', data.projects||[], 'name', 'كل المشاريع'); renderTickets(); };
})();

/* ===== V13: Supervisor ticket live notifications, badge, and auto refresh ===== */
(function(){
  let ticketWatchTimer = null;
  let lastSeenTicketId = 0;
  let watchStarted = false;

  function ticketNoV13(t){ return t.ticket_number || ('T-' + String(t.id||0).padStart(4,'0')); }

  function ensureTicketNoticeUI(){
    if(!document.getElementById('supervisorTicketNotice')){
      const box = document.createElement('div');
      box.id = 'supervisorTicketNotice';
      box.style.cssText = 'display:none;position:fixed;left:14px;right:14px;top:14px;z-index:99999;background:#0A4033;color:#fff;border-radius:16px;padding:13px 15px;box-shadow:0 12px 30px rgba(0,0,0,.22);font-family:Tahoma,Arial,sans-serif;line-height:1.7;';
      document.body.appendChild(box);
    }
    const ticketBtn = [...document.querySelectorAll('.sup-tab')].find(b => (b.textContent||'').includes('التكتات'));
    if(ticketBtn && !ticketBtn.querySelector('#supTicketOpenCount')){
      ticketBtn.innerHTML = 'التكتات <span id="supTicketOpenCount" style="display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;border-radius:999px;background:#b83232;color:#fff;font-size:12px;margin-inline-start:6px;padding:0 6px;">0</span>';
    }
  }

  function supervisorTicketScope(rows){
    const u = session();
    if(!u || u.role !== 'supervisor') return rows || [];
    const pids = new Set((data.projects||[]).map(p => String(p.id)));
    return (rows||[]).filter(t =>
      String(t.supervisor_id||'') === String(u.id) ||
      String(t.created_by||'') === String(u.id) ||
      pids.has(String(t.project_id||''))
    );
  }

  function updateSupervisorTicketBadge(){
    ensureTicketNoticeUI();
    const el = document.getElementById('supTicketOpenCount');
    if(!el) return;
    const openCount = (data.tickets||[]).filter(t => t.status !== 'closed').length;
    el.textContent = openCount;
    el.style.display = openCount > 0 ? 'inline-flex' : 'none';
  }

  function showSupervisorTicketNotice(t){
    ensureTicketNoticeUI();
    const box = document.getElementById('supervisorTicketNotice');
    if(!box) return;
    box.innerHTML = `<b>تكت جديد وصل</b><br>${ticketNoV13(t)} - ${esc(projectName(t.project_id))}<br>${esc(t.title || '')}`;
    box.style.display = 'block';
    clearTimeout(window.__ticketNoticeTimeout);
    window.__ticketNoticeTimeout = setTimeout(()=>{ box.style.display='none'; }, 8000);
  }

  async function pollSupervisorTickets(silent=false){
    const u = session();
    if(!u || u.role !== 'supervisor') return;
    try{
      const {data:rows,error}=await sb.from('tickets').select('*').order('created_at',{ascending:false});
      if(error) return console.warn(error.message);
      const scoped = supervisorTicketScope(rows||[]);
      const newestId = scoped.reduce((m,t)=>Math.max(m, Number(t.id||0)), 0);
      const newTickets = scoped.filter(t => Number(t.id||0) > Number(lastSeenTicketId||0));

      data.tickets = scoped;
      if(typeof renderTickets === 'function') renderTickets();
      if(typeof renderSupervisorDailySummary === 'function') renderSupervisorDailySummary();
      updateSupervisorTicketBadge();

      if(!silent && watchStarted && newTickets.length){
        const latest = newTickets.sort((a,b)=>Number(b.id||0)-Number(a.id||0))[0];
        showSupervisorTicketNotice(latest);
        try{ playAppSound('ticket'); }catch(e){}
      }
      if(newestId > lastSeenTicketId) lastSeenTicketId = newestId;
      watchStarted = true;
    }catch(e){ console.warn('ticket watch failed', e); }
  }

  function startSupervisorTicketWatcher(){
    const u=session();
    if(!u || u.role !== 'supervisor') return;
    ensureTicketNoticeUI();
    updateSupervisorTicketBadge();
    const currentMax = (data.tickets||[]).reduce((m,t)=>Math.max(m, Number(t.id||0)), 0);
    if(!lastSeenTicketId) lastSeenTicketId = currentMax;
    watchStarted = true;
    if(ticketWatchTimer) clearInterval(ticketWatchTimer);
    ticketWatchTimer = setInterval(()=>pollSupervisorTickets(false), 20000);
  }

  const oldRenderTicketsV13 = window.renderTickets;
  window.renderTickets = function(){
    if(typeof oldRenderTicketsV13 === 'function') oldRenderTicketsV13();
    updateSupervisorTicketBadge();
  };

  const oldShowSupervisorWindowV13 = window.showSupervisorWindow;
  window.showSupervisorWindow = function(id, btn){
    if(typeof oldShowSupervisorWindowV13 === 'function') oldShowSupervisorWindowV13(id, btn);
    if(id === 'supTickets'){
      pollSupervisorTickets(true);
    }
  };

  const oldInitSupervisorV13 = window.initSupervisor;
  window.initSupervisor = async function(){
    await oldInitSupervisorV13();
    ensureTicketNoticeUI();
    updateSupervisorTicketBadge();
    startSupervisorTicketWatcher();
  };
})();

/* ===== V15: Technician ticket workspace ===== */
(function(){
  function tNo(t){ return t.ticket_number || ('T-' + String(t.id||0).padStart(4,'0')); }
  function statusLabel(status){ return status==='closed'?'مغلق':(status==='processing'?'تحت المعالجة':'مفتوح'); }
  function priorityLabel(p){ return p==='urgent'?'عاجل':(p==='high'?'مهم':(p==='low'?'منخفض':'عادي')); }
  function shortText(s, n=80){ s=String(s||''); return s.length>n ? esc(s.slice(0,n))+'…' : esc(s||'-'); }
  function d(v){ const x=v?new Date(v):null; return x&&!isNaN(x)?x:null; }
  function between(a,b){ const da=d(a), db=d(b); if(!da||!db)return 0; return Math.max(0, Math.round((db-da)/60000)); }
  function dur(min){ min=Number(min||0); if(!min)return '0د'; const day=Math.floor(min/1440), h=Math.floor((min%1440)/60), m=min%60; const arr=[]; if(day)arr.push(day+'ي'); if(h)arr.push(h+'س'); if(m||!arr.length)arr.push(m+'د'); return arr.join(' '); }
  function openMins(t){ return t.status==='closed' ? (Number(t.open_duration_minutes||0)||between(t.created_at,t.closed_at)) : between(t.created_at,new Date().toISOString()); }
  function rowClass(t){ if(t.status==='closed') return 'ticket-row-closed'; if(t.status==='processing') return 'ticket-row-processing'; if(t.priority==='urgent'||t.priority==='high') return 'ticket-row-urgent'; return 'ticket-row-normal'; }
  function badge(t){ const cls=t.status==='closed'?'green':(t.status==='processing'?'amber':((t.priority==='urgent'||t.priority==='high')?'red':'pink')); return `<span class="badge ${cls}">${statusLabel(t.status)}</span>`; }
  function pri(t){ const cls=t.priority==='urgent'?'red':(t.priority==='high'?'amber':'pink'); return `<span class="badge ${cls}">${priorityLabel(t.priority)}</span>`; }
  function currentTechName(){ const u=session(); return (u && (u.full_name || u.username)) || 'فني'; }
  function filterRows(kind){
    const u=session(); if(!u) return [];
    let rows=[...(data.tickets||[])];
    const q=($('techTicketSearch')?.value||'').trim().toLowerCase();
    const st=$('techTicketStatus')?.value||'';
    if(st) rows=rows.filter(t=>t.status===st);
    if(q) rows=rows.filter(t=>[tNo(t),t.title,t.description,projectName(t.project_id),statusLabel(t.status),t.claimed_by_name,t.closed_by_name,t.closure_note].join(' ').toLowerCase().includes(q));
    if(kind==='open') rows=rows.filter(t=>t.status!=='closed' && !t.claimed_by);
    if(kind==='mine') rows=rows.filter(t=>String(t.claimed_by||'')===String(u.id) && t.status!=='closed');
    if(kind==='done') rows=rows.filter(t=>String(t.closed_by||'')===String(u.id) || (t.status==='closed' && String(t.closed_by_name||'')===String(currentTechName())));
    return rows.sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
  }
  function renderTechList(kind, bodyId){
    const b=$(bodyId); if(!b) return;
    const rows=filterRows(kind);
    b.innerHTML = rows.map(t=>`<tr class="${rowClass(t)}"><td><b>${esc(tNo(t))}</b></td><td>${esc(projectName(t.project_id))}</td><td>${esc(t.title||'-')}</td><td style="white-space:normal;min-width:180px">${shortText(t.description)}</td><td>${pri(t)}</td><td>${badge(t)}</td><td>${esc(dur(openMins(t)))}</td><td>${esc(t.claimed_by_name||'-')}<br><small>${t.claimed_at?fmt(t.claimed_at):''}</small></td><td>${esc(t.closed_by_name||'-')}<br><small>${t.closed_at?fmt(t.closed_at):''}</small></td><td style="white-space:normal;min-width:180px">${shortText(t.closure_note)}</td><td class="row-actions">${t.status==='closed'?'':`${!t.claimed_by?`<button onclick="techClaimTicket(${t.id})">استلام</button>`:''}<button onclick="techCloseTicket(${t.id})">إغلاق</button>`}</td></tr>`).join('') || '<tr><td colspan="11">لا توجد تكتات</td></tr>';
  }
  window.renderTechnicianTickets = function(){ renderTechList('open','techOpenTicketsBody'); renderTechList('mine','techMyTicketsBody'); renderTechList('done','techDoneTicketsBody'); updateTechKpis(); };
  function updateTechKpis(){ const u=session(); if(!$('techOpenCount')) return; $('techOpenCount').textContent=(data.tickets||[]).filter(t=>t.status!=='closed'&&!t.claimed_by).length; $('techMineCount').textContent=(data.tickets||[]).filter(t=>String(t.claimed_by||'')===String(u?.id||'')&&t.status!=='closed').length; $('techDoneCount').textContent=(data.tickets||[]).filter(t=>String(t.closed_by||'')===String(u?.id||'')).length; }
  window.showTechWindow = function(id, btn){ document.querySelectorAll('.tech-page').forEach(p=>p.classList.remove('active')); $(id)?.classList.add('active'); document.querySelectorAll('.tech-tab').forEach(b=>b.classList.remove('active')); btn?.classList.add('active'); renderTechnicianTickets(); };
  window.initTechnician = async function(){ const u=requireRole('technician'); if(!u) return; await loadAll(); if($('techTitle')) $('techTitle').textContent='لوحة الفني - '+(u.full_name||u.username); renderTechnicianTickets(); setInterval(async()=>{ await loadAll(); renderTechnicianTickets(); }, 20000); };
  window.techClaimTicket = async function(id){ const u=session(); if(!u) return msg('سجل الدخول أولاً','err'); const t=(data.tickets||[]).find(x=>String(x.id)===String(id)); if(!t) return msg('التكت غير موجود','err'); if(t.status==='closed') return msg('التكت مغلق','err'); if(t.claimed_by && String(t.claimed_by)!==String(u.id)) return msg('هذا التكت مستلم بواسطة '+(t.claimed_by_name||'شخص آخر'),'err'); const now=new Date().toISOString(); const name=currentTechName(); const {error}=await sb.from('tickets').update({status:'processing',claimed_by:u.id,claimed_by_name:name,claimed_at:t.claimed_at||now,updated_at:now}).eq('id',id); if(error) return msg(error.message,'err'); playAppSound('ticket'); msg('تم استلام التكت بواسطة '+name); await loadAll(); renderTechnicianTickets(); };
  window.techCloseTicket = async function(id){ const u=session(); if(!u) return msg('سجل الدخول أولاً','err'); const t=(data.tickets||[]).find(x=>String(x.id)===String(id)); if(!t) return msg('التكت غير موجود','err'); if(t.status==='closed') return msg('التكت مغلق بالفعل','err'); const note=prompt('كيف تم إغلاق التكت؟\nاكتب الإجراء المنفذ بالتفصيل'); if(!note || !note.trim()) return msg('لا يمكن إغلاق التكت بدون ذكر كيف تم الإغلاق','err'); const now=new Date().toISOString(); const name=currentTechName(); const row={status:'closed',closed_at:now,closed_by:u.id,closed_by_name:name,closure_note:note.trim(),open_duration_minutes:between(t.created_at,now),processing_duration_minutes:t.claimed_at?between(t.claimed_at,now):null,updated_at:now}; if(!t.claimed_at){ row.claimed_by=u.id; row.claimed_by_name=name; row.claimed_at=now; } const {error}=await sb.from('tickets').update(row).eq('id',id); if(error) return msg(error.message,'err'); playAppSound('ticket'); msg('تم إغلاق التكت وحفظ طريقة الإغلاق'); await loadAll(); renderTechnicianTickets(); };
})();

/* ===== V15.1: Supervisor window buttons fix ===== */
window.showSupervisorWindow = function(id, btn){
  document.querySelectorAll('.sup-page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(id);
  if(page) page.classList.add('active');
  document.querySelectorAll('.sup-tab').forEach(b => b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  if(id === 'supTickets' && typeof renderTickets === 'function') renderTickets();
  if(id === 'supSummary' && typeof renderSupervisorDailySummary === 'function') renderSupervisorDailySummary();
};

/* ===== V15.2: Fix supervisor daily summary ===== */
(function(){
  function parseDateSafe(v){
    if(!v) return null;
    const d = new Date(v);
    return isNaN(d) ? null : d;
  }
  function dateOfLog(l){ return l.log_date || String(l.check_in || '').slice(0,10) || ''; }
  function sameDate(a,b){ return String(a||'') === String(b||''); }
  function addDays(dateObj, days){ const d = new Date(dateObj); d.setDate(d.getDate()+days); return d; }
  function localDateStr(d){
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,'0');
    const day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function supervisorSummaryRange(){
    const mode = document.getElementById('summaryRange')?.value || 'today';
    const custom = document.getElementById('summaryDate')?.value;
    const now = new Date();
    const todayStr = localDateStr(now);
    if(mode === 'custom'){
      const d = custom || todayStr;
      return {start:d, end:d, label:d};
    }
    if(mode === 'yesterday'){
      const d = localDateStr(addDays(now,-1));
      return {start:d, end:d, label:'أمس'};
    }
    if(mode === 'week'){
      const start = localDateStr(addDays(now,-6));
      return {start, end:todayStr, label:'آخر 7 أيام'};
    }
    return {start:todayStr, end:todayStr, label:'اليوم'};
  }
  function inRangeDate(ds, range){ return ds && ds >= range.start && ds <= range.end; }
  function ticketStatusClosed(t){ return (t.status || 'open') === 'closed'; }
  function durationText(mins){
    mins = Number(mins || 0);
    const h = Math.floor(mins / 60), m = mins % 60;
    if(h && m) return `${h}س ${m}د`;
    if(h) return `${h}س`;
    return `${m}د`;
  }
  function summaryCard(label, value){
    return `<div class="summary-card-mini"><small>${esc(label)}</small><b>${esc(value)}</b></div>`;
  }
  window.renderSupervisorDailySummary = function(){
    const cards = document.getElementById('supervisorSummaryCards');
    const body = document.getElementById('supervisorSummaryBody');
    if(!cards && !body) return;
    const u = session && session();
    const range = supervisorSummaryRange();
    if(document.getElementById('summaryRange')?.value !== 'custom' && document.getElementById('summaryDate')){
      // Keep custom field available but do not override it every time.
    }

    const logs = (data.logs || []).filter(l => {
      const ds = dateOfLog(l);
      const bySupervisor = !u || !l.supervisor_id || String(l.supervisor_id) === String(u.id);
      return bySupervisor && inRangeDate(ds, range);
    });
    const workMinutes = logs.reduce((sum,l)=>{
      const saved = Number(l.duration_minutes || 0);
      const calc = (typeof minutesBetween === 'function') ? minutesBetween(l.check_in, l.check_out) : 0;
      return sum + (saved > 0 ? saved : calc);
    },0);
    const travelMinutes = logs.reduce((sum,l)=> sum + Number(l.travel_minutes || 0), 0);

    const attendance = (data.attendance || []).filter(a => {
      const ds = a.attendance_date || String(a.created_at || '').slice(0,10);
      const bySupervisor = !u || !a.supervisor_id || String(a.supervisor_id) === String(u.id);
      return bySupervisor && inRangeDate(ds, range);
    });
    const present = attendance.filter(a => a.status === 'present').length;
    const absent = attendance.filter(a => a.status === 'absent').length;

    const tickets = (data.tickets || []).filter(t => {
      const ds = String(t.created_at || '').slice(0,10);
      return inRangeDate(ds, range);
    });
    const openTickets = tickets.filter(t => !ticketStatusClosed(t)).length;
    const closedTickets = tickets.filter(ticketStatusClosed).length;

    if(cards){
      cards.innerHTML = [
        summaryCard('عدد التسجيلات', logs.length),
        summaryCard('ساعات العمل', durationText(workMinutes)),
        summaryCard('وقت التنقل', durationText(travelMinutes)),
        summaryCard('الحضور', present),
        summaryCard('الغياب', absent),
        summaryCard('التكتات المفتوحة', openTickets),
        summaryCard('التكتات المغلقة', closedTickets),
        summaryCard('الفترة', range.label)
      ].join('');
    }
    if(body){
      const rows = [
        ['عدد تسجيلات الدخول والخروج', logs.length],
        ['إجمالي ساعات العمل', durationText(workMinutes)],
        ['إجمالي وقت التنقل', durationText(travelMinutes)],
        ['عدد الحضور', present],
        ['عدد الغياب', absent],
        ['التكتات المفتوحة', openTickets],
        ['التكتات المغلقة', closedTickets]
      ];
      body.innerHTML = rows.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('');
    }
  };

  const prevShowSupervisorWindowV152 = window.showSupervisorWindow;
  window.showSupervisorWindow = function(id, btn){
    if(typeof prevShowSupervisorWindowV152 === 'function') prevShowSupervisorWindowV152(id, btn);
    if(id === 'supSummary') window.renderSupervisorDailySummary();
  };

  const prevInitSupervisorV152 = window.initSupervisor;
  window.initSupervisor = async function(){
    if(typeof prevInitSupervisorV152 === 'function') await prevInitSupervisorV152();
    if(document.getElementById('supSummary')?.classList.contains('active')) window.renderSupervisorDailySummary();
  };
})();

/* V18 عقود المشاريع وتنبيهات نهاية العقد */
(function(){
  const $safe = (id)=>document.getElementById(id);
  function isoDate(d){ if(!d) return ''; return String(d).slice(0,10); }
  function parseDateOnly(s){ if(!s) return null; const parts=String(s).slice(0,10).split('-').map(Number); if(parts.length!==3||!parts[0]) return null; return new Date(parts[0], parts[1]-1, parts[2]); }
  function daysLeft(end){ const e=parseDateOnly(end); if(!e) return null; const t=new Date(); const today=new Date(t.getFullYear(),t.getMonth(),t.getDate()); return Math.ceil((e-today)/86400000); }
  function contractInfo(p){
    const d=daysLeft(p.contract_end);
    if(d===null) return {key:'missing', text:'بيانات ناقصة', cls:'amber', days:'-'};
    if(d < 0) return {key:'expired', text:'منتهي', cls:'red', days:'منتهي'};
    if(d <= 30) return {key:'soon', text:'قريب الانتهاء', cls:'amber', days:d + ' يوم'};
    return {key:'active', text:'نشط', cls:'green', days:d + ' يوم'};
  }
  function esc2(x){ try{return typeof esc==='function'?esc(x):String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}catch(_){return x||'';} }
  function badgeContract(p){ const c=contractInfo(p); return `<span class="badge ${c.cls}">${c.text}</span>`; }


  async function recalcProjectDailyLogs(projectId, projectRow){
    projectId = Number(projectId || 0);
    if(!projectId || !projectRow) return {updated:0, failed:0};
    const q = await sb.from('time_logs').select('*').eq('project_id', projectId);
    if(q.error){ console.warn(q.error.message); return {updated:0, failed:1}; }
    const logs = q.data || [];
    let updated = 0, failed = 0;
    for(const l of logs){
      const logDate = (l.log_date || String(l.check_in||'').slice(0,10));
      const day = logDate ? new Date(logDate+'T00:00:00').getDay() : null;
      const required = day === 5 ? Number(projectRow.friday_minutes || 0) : Number(projectRow.required_daily_minutes || 0);
      const actual = Number(l.duration_minutes || minutesBetween(l.check_in, l.check_out));
      const ts = calcTimeStatus(actual, required);
      const upd = {
        required_minutes: required,
        duration_minutes: actual,
        time_difference_minutes: ts.diff,
        time_status: ts.status
      };
      const r = await sb.from('time_logs').update(upd).eq('id', l.id);
      if(r.error){ failed++; console.warn(r.error.message); } else updated++;
    }
    return {updated, failed};
  }

  const oldSaveProject = window.saveProject;
  window.saveProject = async function(){
    const id=$safe('projectId')?.value;
    const row={
      name:$safe('projectName')?.value?.trim(),
      location:$safe('projectLocation')?.value?.trim(),
      supervisor_id:Number($safe('projectSupervisor')?.value)||null,
      buildings_count:Number($safe('projectBuildingsCount')?.value)||0,
      units_count:Number($safe('projectUnitsCount')?.value)||0,
      contract_start:$safe('projectContractStart')?.value||null,
      contract_end:$safe('projectContractEnd')?.value||null,
      required_daily_minutes:Number($safe('projectRequiredDaily')?.value||180),
      friday_minutes:Number($safe('projectFridayMinutes')?.value||90),
      operation_type:$safe('projectOperationType')?.value||'daily_visit',
      visit_type_default:$safe('projectVisitDefault')?.value||'surface',
      status:$safe('projectStatus')?.value||'active',
      notes:$safe('projectNotes')?.value||''
    };
    if(!row.name) return msg('اسم المشروع مطلوب','err');
    const res=id?await sb.from('projects').update(row).eq('id',id):await sb.from('projects').insert(row);
    if(res.error) return msg(res.error.message,'err');
    if(id){
      const rr = await recalcProjectDailyLogs(id, row);
      msg('تم تحديث المشروع وتحديث الوقت المطلوب في السجلات اليومية' + (rr.updated ? ` (${rr.updated} سجل)` : ''));
    } else {
      msg('تم حفظ المشروع');
    }
    if(typeof clearProjectForm==='function') clearProjectForm();
    await refreshAll();
  };

  const oldEditProject = window.editProject;
  window.editProject = function(id){
    const p=(data.projects||[]).find(x=>String(x.id)===String(id));
    if(!p) return;
    if(typeof oldEditProject==='function') oldEditProject(id);
    if($safe('projectBuildingsCount')) $safe('projectBuildingsCount').value=p.buildings_count||0;
    if($safe('projectUnitsCount')) $safe('projectUnitsCount').value=p.units_count||0;
    if($safe('projectContractStart')) $safe('projectContractStart').value=isoDate(p.contract_start);
    if($safe('projectContractEnd')) $safe('projectContractEnd').value=isoDate(p.contract_end);
  };

  const oldClearProjectForm = window.clearProjectForm;
  window.clearProjectForm = function(){
    if(typeof oldClearProjectForm==='function') oldClearProjectForm();
    if($safe('projectBuildingsCount')) $safe('projectBuildingsCount').value=0;
    if($safe('projectUnitsCount')) $safe('projectUnitsCount').value=0;
    if($safe('projectContractStart')) $safe('projectContractStart').value='';
    if($safe('projectContractEnd')) $safe('projectContractEnd').value='';
  };

  window.renderContractAlerts = function(){
    const projects=data.projects||[];
    const relevant=projects.map(p=>({p,c:contractInfo(p)})).filter(x=>['soon','expired','missing'].includes(x.c.key));
    const html = relevant.sort((a,b)=>{
      const da=daysLeft(a.p.contract_end); const db=daysLeft(b.p.contract_end);
      return (da??99999)-(db??99999);
    }).map(x=>`<div class="alert-item ${x.c.key==='expired'?'danger':'warn'}"><b>${esc2(x.p.name)}</b><br>نهاية العقد: ${esc2(isoDate(x.p.contract_end)||'-')}<br>المتبقي: ${x.c.days} - ${x.c.text}</div>`).join('') || '<div class="alert-item">لا توجد عقود قريبة الانتهاء خلال 30 يوم</div>';
    if($safe('contractDashboardAlerts')) $safe('contractDashboardAlerts').innerHTML=html;
    if($safe('contractsAlertsList')) $safe('contractsAlertsList').innerHTML=html;
  };

  window.renderContracts = function(){
    const body=$safe('contractsBody');
    if(!body) return;
    const q=($safe('contractSearch')?.value||'').trim();
    const st=$safe('contractFilterStatus')?.value||'';
    let rows=[...(data.projects||[])];
    if(q) rows=rows.filter(p=>String(p.name||'').includes(q));
    if(st) rows=rows.filter(p=>contractInfo(p).key===st);
    rows.sort((a,b)=>{ const da=daysLeft(a.contract_end); const db=daysLeft(b.contract_end); return (da??999999)-(db??999999); });
    body.innerHTML=rows.map(p=>{ const c=contractInfo(p); return `<tr><td><b>${esc2(p.name)}</b></td><td>${p.buildings_count||0}</td><td>${p.units_count||0}</td><td>${esc2(isoDate(p.contract_start)||'-')}</td><td>${esc2(isoDate(p.contract_end)||'-')}</td><td>${c.days}</td><td><span class="badge ${c.cls}">${c.text}</span></td><td><button onclick="showPage('projects', document.querySelector(\`.nav[onclick*=projects]\`)); setTimeout(()=>editProject(${p.id}),50)">تعديل</button></td></tr>`; }).join('') || '<tr><td colspan="8">لا توجد بيانات</td></tr>';
    if($safe('contractsActiveCount')) $safe('contractsActiveCount').textContent=(data.projects||[]).filter(p=>contractInfo(p).key==='active').length;
    if($safe('contractsSoonCount')) $safe('contractsSoonCount').textContent=(data.projects||[]).filter(p=>contractInfo(p).key==='soon').length;
    if($safe('contractsExpiredCount')) $safe('contractsExpiredCount').textContent=(data.projects||[]).filter(p=>contractInfo(p).key==='expired').length;
    if($safe('contractsMissingCount')) $safe('contractsMissingCount').textContent=(data.projects||[]).filter(p=>contractInfo(p).key==='missing').length;
  };

  window.renderProjects = function(){
    const b=$safe('projectsBody'); if(!b) return;
    const q=($safe('projectSearch')?.value||'').trim(), sid=$safe('projectFilterSupervisor')?.value, st=$safe('projectFilterStatus')?.value;
    let rows=data.projects||[];
    if(q) rows=rows.filter(p=>[p.name,p.location,supervisorName(p.supervisor_id),p.notes].join(' ').includes(q));
    if(sid) rows=rows.filter(p=>String(p.supervisor_id)===String(sid));
    if(st) rows=rows.filter(p=>(p.status||'active')===st);
    b.innerHTML=rows.map(p=>{ const c=contractInfo(p); return `<tr><td><b>${esc2(p.name)}</b><br><small>${esc2(p.location||'')}</small></td><td>${esc2(supervisorName(p.supervisor_id))}</td><td>${p.buildings_count||0}</td><td>${p.units_count||0}</td><td>${esc2(isoDate(p.contract_end)||'-')}</td><td>${c.days}</td><td><span class="badge ${c.cls}">${c.text}</span></td><td>${minsToText(p.required_daily_minutes??180)}</td><td><span class="badge ${p.status==='inactive'?'red':'green'}">${p.status==='inactive'?'متوقف':'نشط'}</span></td><td class="row-actions"><button onclick="editProject(${p.id})">تعديل</button><button class="light" onclick="openProjectManager(${p.id})">إدارة المشروع</button><button class="light" onclick="toggleProjectStatus(${p.id})">${p.status==='inactive'?'تفعيل':'إيقاف'}</button><button class="danger" onclick="deleteRow('projects',${p.id})">حذف</button></td></tr>`; }).join('')||'<tr><td colspan="10">لا توجد بيانات</td></tr>';
    if(typeof renderProjectManager==='function') renderProjectManager();
    renderContracts(); renderContractAlerts();
  };

  const oldRenderDashboard = window.renderDashboard;
  window.renderDashboard = function(){ if(typeof oldRenderDashboard==='function') oldRenderDashboard(); renderContractAlerts(); };
  const oldRenderAll = window.renderAll;
  window.renderAll = function(){ if(typeof oldRenderAll==='function') oldRenderAll(); renderContracts(); renderContractAlerts(); };
})();

/* ===== V42: Clear WhatsApp column for tickets ===== */
(function(){
  function _e(v){return (typeof esc==='function'?esc(v):String(v??''));}
  function _no(t){return t.ticket_number || ('T-' + String(t.id||0).padStart(4,'0'));}
  function _status(s){return s==='closed'?'مغلق':(s==='processing'?'تحت المعالجة':'مفتوح');}
  function _priority(p){return p==='urgent'?'عاجل':(p==='high'?'مهم':(p==='low'?'منخفض':'عادي'));}
  function _short(s,n=90){s=String(s||'');return s.length>n?_e(s.slice(0,n))+'…':_e(s||'-');}
  function _date(v){const d=v?new Date(v):new Date();const x=isNaN(d)?new Date():d;return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');}
  function _time(v){const d=v?new Date(v):new Date();const x=isNaN(d)?new Date():d;let h=x.getHours();const m=String(x.getMinutes()).padStart(2,'0');const ap=h>=12?'م':'ص';h=h%12||12;return String(h).padStart(2,'0')+':'+m+' '+ap;}
  function _between(a,b){const da=a?new Date(a):null,db=b?new Date(b):null;if(!da||!db||isNaN(da)||isNaN(db))return 0;return Math.max(0,Math.round((db-da)/60000));}
  function _dur(min){min=Number(min||0);if(!min)return '0د';const d=Math.floor(min/1440),h=Math.floor((min%1440)/60),m=min%60;const p=[];if(d)p.push(d+'ي');if(h)p.push(h+'س');if(m||!p.length)p.push(m+'د');return p.join(' ');}
  function _openMins(t){return t.status==='closed'?(Number(t.open_duration_minutes||0)||_between(t.created_at,t.closed_at)):_between(t.created_at,new Date().toISOString());}
  function _row(t){if(t.status==='closed')return 'ticket-row-closed';if(t.status==='processing')return 'ticket-row-processing';if(t.priority==='urgent'||t.priority==='high')return 'ticket-row-urgent';return 'ticket-row-normal';}
  function _sb(t){const cls=t.status==='closed'?'green':(t.status==='processing'?'amber':((t.priority==='urgent'||t.priority==='high')?'red':'pink'));return `<span class="badge ${cls}">${_status(t.status)}</span>`;}
  function _pb(t){const cls=t.priority==='urgent'?'red':(t.priority==='high'?'amber':'pink');return `<span class="badge ${cls}">${_priority(t.priority)}</span>`;}
  function _proj(t){return (typeof projectName==='function'?projectName(t.project_id):'') || t.project_name || '-';}
  function _problem(t){return t.description || t.title || '-';}
  window.buildTicketWhatsAppTextV42=function(t){const closed=t.status==='closed';const v=closed?(t.closed_at||t.updated_at):t.created_at;return [(closed?'تم إغلاق التكت':'تم تسجيل تكت جديد'),'','اسم المشروع: '+_proj(t),'رقم التكت: '+_no(t),'وصف المشكلة: '+_problem(t),'حالة المشكلة: '+(closed?'مغلق':_status(t.status)),'التاريخ: '+_date(v),'الوقت: '+_time(v)].join('\n');};
  function _copy(text){if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(text).catch(()=>{});const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');}catch(e){}ta.remove();return Promise.resolve();}
  window.sendTicketWhatsApp=function(id){const t=(data.tickets||[]).find(x=>String(x.id)===String(id));if(!t)return msg('التكت غير موجود','err');const text=window.buildTicketWhatsAppTextV42(t);_copy(text).finally(()=>{window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank');msg(t.status==='closed'?'تم تجهيز رسالة إغلاق التكت للواتساب':'تم تجهيز رسالة فتح التكت للواتساب');});};
  function _wab(t){return `<button class="wa-ticket-btn-v42" onclick="sendTicketWhatsApp(${t.id})">واتساب<br><small>${t.status==='closed'?'إغلاق التكت':'فتح التكت'}</small></button>`;}
  window.renderTickets=function(){const adminBody=$('ticketsBody'),supBody=$('supTicketsBody');if(!adminBody&&!supBody)return;const rows=[...(data.tickets||[])];
    if(adminBody){const st=$('ticketFilterStatus')?.value||'',q=($('ticketSearch')?.value||'').trim().toLowerCase();let list=rows;if(st)list=list.filter(t=>t.status===st);if(q)list=list.filter(t=>[_no(t),t.title,t.description,_proj(t),supervisorName(t.supervisor_id),_status(t.status),t.claimed_by_name,t.closed_by_name,t.closure_note].join(' ').toLowerCase().includes(q));adminBody.innerHTML=list.map(t=>`<tr class="${_row(t)}"><td><b>${_e(_no(t))}</b></td><td>${_e(_proj(t))}</td><td>${_e(supervisorName(t.supervisor_id))}</td><td>${_e(t.title||'-')}</td><td style="white-space:normal;min-width:220px">${_short(t.description)}</td><td>${_pb(t)}</td><td>${_sb(t)}</td><td>${fmt(t.created_at)}</td><td>${_e(_dur(_openMins(t)))}</td><td>${_e(t.claimed_by_name||'-')}<br><small>${t.claimed_at?fmt(t.claimed_at):''}</small></td><td>${_e(t.closed_by_name||'-')}<br><small>${t.closed_at?fmt(t.closed_at):''}</small></td><td style="white-space:normal;min-width:220px">${_short(t.closure_note)}</td><td class="whatsapp-col">${_wab(t)}</td><td class="row-actions"><button onclick="editTicket(${t.id})">تعديل</button>${t.status==='closed'?`<button class="light" onclick="setTicketStatus(${t.id},'open')">إعادة فتح</button>`:`${t.status!=='processing'?`<button class="light" onclick="claimTicket(${t.id})">استلام</button>`:''}<button onclick="closeTicket(${t.id})">إغلاق</button>`}<button class="danger" onclick="deleteRow('tickets',${t.id})">حذف</button></td></tr>`).join('')||'<tr><td colspan="14">لا توجد تكتات</td></tr>';}
    if(supBody){const st=$('supTicketFilterStatus')?.value||'',pid=$('supTicketFilterProject')?.value||'',q=($('supTicketSearch')?.value||'').trim().toLowerCase();let list=rows;if(pid)list=list.filter(t=>String(t.project_id)===String(pid));if(st)list=list.filter(t=>t.status===st);if(q)list=list.filter(t=>[_no(t),t.title,t.description,_proj(t),_status(t.status),t.claimed_by_name,t.closed_by_name,t.closure_note].join(' ').toLowerCase().includes(q));supBody.innerHTML=list.map(t=>`<tr class="${_row(t)}"><td><b>${_e(_no(t))}</b></td><td>${_e(_proj(t))}</td><td>${_e(t.title||'-')}</td><td style="white-space:normal;min-width:180px">${_short(t.description)}</td><td>${_pb(t)}</td><td>${_sb(t)}</td><td>${_e(_dur(_openMins(t)))}</td><td>${_e(t.claimed_by_name||'-')}</td><td>${_e(t.closed_by_name||'-')}</td><td style="white-space:normal;min-width:180px">${_short(t.closure_note)}</td><td class="whatsapp-col">${_wab(t)}</td><td class="row-actions"><button onclick="editTicket(${t.id})">تعديل</button>${t.status==='closed'?`<button class="light" onclick="setTicketStatus(${t.id},'open')">إعادة فتح</button>`:`${t.status!=='processing'?`<button class="light" onclick="claimTicket(${t.id})">استلام</button>`:''}<button onclick="closeTicket(${t.id})">إغلاق</button>`}</td></tr>`).join('')||'<tr><td colspan="12">لا توجد تكتات</td></tr>';}
  };
  const css=document.createElement('style');css.textContent='.wa-ticket-btn-v42{background:#128C7E!important;color:white!important;border:0!important;border-radius:10px!important;padding:8px 10px!important;line-height:1.25!important;min-width:110px!important;font-weight:700!important}.wa-ticket-btn-v42 small{font-weight:500;font-size:10px;color:white!important}.whatsapp-col{white-space:nowrap;text-align:center!important}';document.head.appendChild(css);
})();

/* ===== V43: Force WhatsApp button in supervisor tickets too ===== */
(function(){
  function _safeTicketNo(t){return t.ticket_number || ('T-' + String(t.id||0).padStart(4,'0'));}
  function _statusLabel43(s){return s==='closed'?'مغلق':(s==='processing'?'تحت المعالجة':'مفتوح');}
  function _date43(v){try{const d=v?new Date(v):new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}catch(e){return '';}}
  function _time43(v){try{const d=v?new Date(v):new Date();return d.toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});}catch(e){return '';}}
  function _project43(t){try{return projectName(t.project_id)||t.project_name||'-';}catch(e){return t.project_name||'-';}}
  function _msg43(t){const closed=t.status==='closed';const dt=closed?(t.closed_at||t.updated_at||t.created_at):(t.created_at||t.updated_at);return [closed?'تم إغلاق التكت':'تم تسجيل تكت جديد','',`اسم المشروع: ${_project43(t)}`,`رقم التكت: ${_safeTicketNo(t)}`,`وصف المشكلة: ${t.description||t.title||'-'}`,`حالة المشكلة: ${closed?'مغلق':_statusLabel43(t.status)}`,`التاريخ: ${_date43(dt)}`,`الوقت: ${_time43(dt)}`].join('\n');}
  window.sendTicketWhatsAppV43=function(id){const t=(data.tickets||[]).find(x=>String(x.id)===String(id)); if(!t){ if(typeof msg==='function') msg('التكت غير موجود','err'); return; } const txt=_msg43(t); const go=function(){window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank'); if(typeof msg==='function') msg(t.status==='closed'?'تم تجهيز رسالة إغلاق التكت للواتساب':'تم تجهيز رسالة فتح التكت للواتساب');}; if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).finally(go); else go();};
  function _btn43(t){return `<button type="button" class="wa-ticket-btn-v43" onclick="sendTicketWhatsAppV43(${t.id})">واتساب<br><small>${t.status==='closed'?'إغلاق التكت':'فتح التكت'}</small></button>`;}
  function forceSupervisorWhatsApp43(){
    const body=document.getElementById('supTicketsBody'); if(!body) return;
    const rows=Array.from(body.querySelectorAll('tr')); if(!rows.length) return;
    rows.forEach(function(tr,i){
      if((tr.innerText||'').includes('لا توجد')) return;
      if(tr.querySelector('.wa-ticket-btn-v43') || tr.querySelector('.wa-ticket-btn-v42')) return;
      const first=tr.cells&&tr.cells[0]?tr.cells[0].innerText.trim():'';
      let t=(data.tickets||[]).find(function(x){return _safeTicketNo(x)===first;});
      if(!t) t=(data.tickets||[])[i];
      if(!t) return;
      const target=tr.cells[10] || tr.cells[tr.cells.length-1];
      if(target){ target.innerHTML=_btn43(t); target.classList.add('whatsapp-col'); }
    });
  }
  const oldRenderTickets43=window.renderTickets;
  window.renderTickets=function(){ if(typeof oldRenderTickets43==='function') oldRenderTickets43.apply(this,arguments); setTimeout(forceSupervisorWhatsApp43,80); setTimeout(forceSupervisorWhatsApp43,400); };
  const oldShowSupervisorWindow43=window.showSupervisorWindow;
  window.showSupervisorWindow=function(id,btn){ if(typeof oldShowSupervisorWindow43==='function') oldShowSupervisorWindow43.apply(this,arguments); if(id==='supTickets') setTimeout(forceSupervisorWhatsApp43,700); };
  window.addEventListener('load',function(){setTimeout(forceSupervisorWhatsApp43,900);setTimeout(forceSupervisorWhatsApp43,1800);});
  const css=document.createElement('style');css.textContent='.wa-ticket-btn-v43{background:#128C7E!important;color:white!important;border:0!important;border-radius:10px!important;padding:8px 10px!important;line-height:1.25!important;min-width:110px!important;font-weight:700!important;cursor:pointer!important}.wa-ticket-btn-v43 small{font-weight:500;font-size:10px;color:white!important}.whatsapp-col{white-space:nowrap;text-align:center!important}';document.head.appendChild(css);
})();


/* ===== V45: FINAL FIX - Supervisor ticket WhatsApp button ===== */
(function(){
  function _v45Esc(v){return String(v??'').replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});}
  function _v45No(t){return t.ticket_number || ('T-' + String(t.id||0).padStart(4,'0'));}
  function _v45Status(s){return s==='closed'?'مغلق':(s==='processing'?'تحت المعالجة':'مفتوح');}
  function _v45Priority(p){return p==='urgent'?'عاجل':(p==='high'?'مهم':(p==='low'?'منخفض':'عادي'));}
  function _v45Project(t){try{return projectName(t.project_id)||t.project_name||'-';}catch(e){return t.project_name||'-';}}
  function _v45Short(s,n){s=String(s||'-');return _v45Esc(s.length>(n||90)?s.slice(0,(n||90))+'…':s);}
  function _v45Date(v){try{const d=v?new Date(v):new Date();if(isNaN(d))return '-';return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}catch(e){return '-';}}
  function _v45Time(v){try{const d=v?new Date(v):new Date();if(isNaN(d))return '-';let h=d.getHours();const m=String(d.getMinutes()).padStart(2,'0');const ap=h>=12?'م':'ص';h=h%12||12;return String(h).padStart(2,'0')+':'+m+' '+ap;}catch(e){return '-';}}
  function _v45Mins(a,b){const da=a?new Date(a):null,db=b?new Date(b):new Date();if(!da||isNaN(da)||isNaN(db))return 0;return Math.max(0,Math.round((db-da)/60000));}
  function _v45Dur(m){m=Number(m||0);if(!m)return '0د';const d=Math.floor(m/1440),h=Math.floor((m%1440)/60),mm=m%60;let arr=[];if(d)arr.push(d+'ي');if(h)arr.push(h+'س');if(mm||!arr.length)arr.push(mm+'د');return arr.join(' ');}
  function _v45OpenM(t){return t.status==='closed'?(Number(t.open_duration_minutes||0)||_v45Mins(t.created_at,t.closed_at)):_v45Mins(t.created_at,new Date().toISOString());}
  function _v45Row(t){if(t.status==='closed')return 'ticket-row-closed';if(t.status==='processing')return 'ticket-row-processing';if(t.priority==='urgent'||t.priority==='high')return 'ticket-row-urgent';return 'ticket-row-normal';}
  function _v45Sb(t){const cls=t.status==='closed'?'green':(t.status==='processing'?'amber':((t.priority==='urgent'||t.priority==='high')?'red':'pink'));return '<span class="badge '+cls+'">'+_v45Status(t.status)+'</span>';}
  function _v45Pb(t){const cls=t.priority==='urgent'?'red':(t.priority==='high'?'amber':'pink');return '<span class="badge '+cls+'">'+_v45Priority(t.priority)+'</span>';}
  function _v45Text(t){const closed=t.status==='closed';const v=closed?(t.closed_at||t.updated_at||t.created_at):(t.created_at||t.updated_at);return [closed?'تم إغلاق التكت':'تم تسجيل تكت جديد','','اسم المشروع: '+_v45Project(t),'رقم التكت: '+_v45No(t),'وصف المشكلة: '+(t.description||t.title||'-'),'حالة المشكلة: '+(closed?'مغلق':_v45Status(t.status)),'التاريخ: '+_v45Date(v),'الوقت: '+_v45Time(v)].join('\n');}
  window.sendSupervisorTicketWhatsAppV45=function(id){const t=(data.tickets||[]).find(x=>String(x.id)===String(id));if(!t){if(typeof msg==='function')msg('التكت غير موجود','err');return;}const text=_v45Text(t);const go=()=>{window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank');if(typeof msg==='function')msg(t.status==='closed'?'تم تجهيز رسالة إغلاق التكت للواتساب':'تم تجهيز رسالة فتح التكت للواتساب');};if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).finally(go);else go();};
  function _v45Btn(t){return '<button type="button" class="wa-ticket-btn-v45" onclick="sendSupervisorTicketWhatsAppV45('+t.id+')">واتساب<br><small>'+(t.status==='closed'?'إغلاق التكت':'فتح التكت')+'</small></button>';}
  function renderSupervisorTicketsV45(){
    const body=document.getElementById('supTicketsBody'); if(!body) return false;
    let list=[...(data.tickets||[])];
    const st=document.getElementById('supTicketFilterStatus')?.value||'';
    const pid=document.getElementById('supTicketFilterProject')?.value||'';
    const q=(document.getElementById('supTicketSearch')?.value||'').trim().toLowerCase();
    if(pid) list=list.filter(t=>String(t.project_id)===String(pid));
    if(st) list=list.filter(t=>t.status===st);
    if(q) list=list.filter(t=>[_v45No(t),t.title,t.description,_v45Project(t),_v45Status(t.status),t.claimed_by_name,t.closed_by_name,t.closure_note].join(' ').toLowerCase().includes(q));
    body.innerHTML=list.map(t=>'<tr class="'+_v45Row(t)+'"><td><b>'+_v45Esc(_v45No(t))+'</b></td><td>'+_v45Esc(_v45Project(t))+'</td><td>'+_v45Esc(t.title||'-')+'</td><td style="white-space:normal;min-width:180px">'+_v45Short(t.description,90)+'</td><td>'+_v45Pb(t)+'</td><td>'+_v45Sb(t)+'</td><td>'+_v45Esc(_v45Dur(_v45OpenM(t)))+'</td><td>'+_v45Esc(t.claimed_by_name||'-')+'</td><td>'+_v45Esc(t.closed_by_name||'-')+'</td><td style="white-space:normal;min-width:180px">'+_v45Short(t.closure_note,90)+'</td><td class="whatsapp-col">'+_v45Btn(t)+'</td><td class="row-actions"><button onclick="editTicket('+t.id+')">تعديل</button>'+(t.status==='closed'?'<button class="light" onclick="setTicketStatus('+t.id+',\'open\')">إعادة فتح</button>':((t.status!=='processing'?'<button class="light" onclick="claimTicket('+t.id+')">استلام</button>':'')+'<button onclick="closeTicket('+t.id+')">إغلاق</button>'))+'</td></tr>').join('') || '<tr><td colspan="12">لا توجد تكتات</td></tr>';
    return true;
  }
  const oldRenderTicketsV45=window.renderTickets;
  window.renderTickets=function(){ if(document.getElementById('supTicketsBody')) return renderSupervisorTicketsV45(); if(typeof oldRenderTicketsV45==='function') return oldRenderTicketsV45.apply(this,arguments); };
  const oldShowSupervisorWindowV45=window.showSupervisorWindow;
  window.showSupervisorWindow=function(id,btn){ if(typeof oldShowSupervisorWindowV45==='function') oldShowSupervisorWindowV45.apply(this,arguments); if(id==='supTickets'){setTimeout(renderSupervisorTicketsV45,50);setTimeout(renderSupervisorTicketsV45,300);} };
  const oldInitSupervisorV45=window.initSupervisor;
  window.initSupervisor=async function(){ if(typeof oldInitSupervisorV45==='function') await oldInitSupervisorV45.apply(this,arguments); setTimeout(renderSupervisorTicketsV45,80); setTimeout(renderSupervisorTicketsV45,600); };
  window.renderSupervisorTicketsV45=renderSupervisorTicketsV45;
  const css=document.createElement('style');css.textContent='.wa-ticket-btn-v45{background:#128C7E!important;color:#fff!important;border:0!important;border-radius:10px!important;padding:8px 10px!important;line-height:1.25!important;min-width:110px!important;font-weight:700!important;cursor:pointer!important}.wa-ticket-btn-v45 small{font-weight:500!important;font-size:10px!important;color:#fff!important}.whatsapp-col{text-align:center!important;white-space:nowrap!important}';document.head.appendChild(css);
  window.addEventListener('load',function(){setTimeout(renderSupervisorTicketsV45,1000);setTimeout(renderSupervisorTicketsV45,2200);});
})();


/* ===== V46: Technician can create tickets + WhatsApp buttons ===== */
(function(){
  function _e(v){ return (typeof esc==='function') ? esc(v) : String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function _tNo(t){ return t.ticket_number || ('T-' + String(t.id||0).padStart(4,'0')); }
  function _statusLabel(status){ return status==='closed'?'مغلق':(status==='processing'?'تحت المعالجة':'مفتوح'); }
  function _priorityLabel(p){ return p==='urgent'?'عاجل':(p==='high'?'مهم':(p==='low'?'منخفض':'عادي')); }
  function _short(s,n=80){ s=String(s||''); return s.length>n ? _e(s.slice(0,n))+'…' : _e(s||'-'); }
  function _dateObj(v){ const x=v?new Date(v):null; return x&&!isNaN(x)?x:null; }
  function _between(a,b){ const da=_dateObj(a), db=_dateObj(b); if(!da||!db)return 0; return Math.max(0, Math.round((db-da)/60000)); }
  function _dur(min){ min=Number(min||0); if(!min)return '0د'; const day=Math.floor(min/1440), h=Math.floor((min%1440)/60), m=min%60; const arr=[]; if(day)arr.push(day+'ي'); if(h)arr.push(h+'س'); if(m||!arr.length)arr.push(m+'د'); return arr.join(' '); }
  function _openMins(t){ return t.status==='closed' ? (Number(t.open_duration_minutes||0)||_between(t.created_at,t.closed_at)) : _between(t.created_at,new Date().toISOString()); }
  function _rowClass(t){ if(t.status==='closed') return 'ticket-row-closed'; if(t.status==='processing') return 'ticket-row-processing'; if(t.priority==='urgent'||t.priority==='high') return 'ticket-row-urgent'; return 'ticket-row-normal'; }
  function _badge(t){ const cls=t.status==='closed'?'green':(t.status==='processing'?'amber':((t.priority==='urgent'||t.priority==='high')?'red':'pink')); return `<span class="badge ${cls}">${_statusLabel(t.status)}</span>`; }
  function _pri(t){ const cls=t.priority==='urgent'?'red':(t.priority==='high'?'amber':'pink'); return `<span class="badge ${cls}">${_priorityLabel(t.priority)}</span>`; }
  function _currentTechName(){ const u=session(); return (u && (u.full_name || u.username)) || 'فني'; }
  function _projectName(id){ return (typeof projectName==='function') ? projectName(id) : ((data.projects||[]).find(p=>String(p.id)===String(id))?.name || '-'); }
  function _fmt(v){ return (typeof fmt==='function') ? fmt(v) : (v ? new Date(v).toLocaleString('ar-SA') : ''); }
  function _waBtn(t){
    const fn = window.sendTicketWhatsAppV43 || window.sendTicketWhatsApp;
    if(!fn) return '-';
    return `<button type="button" class="wa-ticket-btn-v46" onclick="${fn===window.sendTicketWhatsAppV43?'sendTicketWhatsAppV43':'sendTicketWhatsApp'}(${t.id})">واتساب<br><small>${t.status==='closed'?'إغلاق التكت':'فتح التكت'}</small></button>`;
  }
  function _filterTechRows(kind){
    const u=session(); if(!u) return [];
    let rows=[...(data.tickets||[])];
    const q=($('techTicketSearch')?.value||'').trim().toLowerCase();
    const st=$('techTicketStatus')?.value||'';
    if(st) rows=rows.filter(t=>t.status===st);
    if(q) rows=rows.filter(t=>[_tNo(t),t.title,t.description,_projectName(t.project_id),_statusLabel(t.status),t.claimed_by_name,t.closed_by_name,t.closure_note].join(' ').toLowerCase().includes(q));
    if(kind==='open') rows=rows.filter(t=>t.status!=='closed' && !t.claimed_by);
    if(kind==='mine') rows=rows.filter(t=>String(t.claimed_by||'')===String(u.id) && t.status!=='closed');
    if(kind==='done') rows=rows.filter(t=>String(t.closed_by||'')===String(u.id) || (t.status==='closed' && String(t.closed_by_name||'')===String(_currentTechName())));
    return rows.sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
  }
  function _renderTechList(kind, bodyId){
    const b=$(bodyId); if(!b) return;
    const rows=_filterTechRows(kind);
    b.innerHTML = rows.map(t=>`<tr class="${_rowClass(t)}"><td><b>${_e(_tNo(t))}</b></td><td>${_e(_projectName(t.project_id))}</td><td>${_e(t.title||'-')}</td><td style="white-space:normal;min-width:180px">${_short(t.description)}</td><td>${_pri(t)}</td><td>${_badge(t)}</td><td>${_e(_dur(_openMins(t)))}</td><td>${_e(t.claimed_by_name||'-')}<br><small>${t.claimed_at?_fmt(t.claimed_at):''}</small></td><td>${_e(t.closed_by_name||'-')}<br><small>${t.closed_at?_fmt(t.closed_at):''}</small></td><td style="white-space:normal;min-width:180px">${_short(t.closure_note)}</td><td class="whatsapp-col">${_waBtn(t)}</td><td class="row-actions">${t.status==='closed'?'':`${!t.claimed_by?`<button onclick="techClaimTicket(${t.id})">استلام</button>`:''}<button onclick="techCloseTicket(${t.id})">إغلاق</button>`}</td></tr>`).join('') || '<tr><td colspan="12">لا توجد تكتات</td></tr>';
  }
  function _updateTechKpisV46(){ const u=session(); if(!$('techOpenCount')) return; $('techOpenCount').textContent=(data.tickets||[]).filter(t=>t.status!=='closed'&&!t.claimed_by).length; $('techMineCount').textContent=(data.tickets||[]).filter(t=>String(t.claimed_by||'')===String(u?.id||'')&&t.status!=='closed').length; $('techDoneCount').textContent=(data.tickets||[]).filter(t=>String(t.closed_by||'')===String(u?.id||'')).length; }
  window.renderTechnicianTickets = function(){ _renderTechList('open','techOpenTicketsBody'); _renderTechList('mine','techMyTicketsBody'); _renderTechList('done','techDoneTicketsBody'); _updateTechKpisV46(); };
  window.clearTechnicianTicketForm = function(){
    if($('techNewTicketProject')) $('techNewTicketProject').value='';
    if($('techNewTicketPriority')) $('techNewTicketPriority').value='normal';
    if($('techNewTicketTitle')) $('techNewTicketTitle').value='';
    if($('techNewTicketDescription')) $('techNewTicketDescription').value='';
  };
  window.saveTechnicianTicket = async function(){
    const u=session(); if(!u) return msg('سجل الدخول أولاً','err');
    const projectId=Number($('techNewTicketProject')?.value)||null;
    const title=($('techNewTicketTitle')?.value||'').trim();
    const description=($('techNewTicketDescription')?.value||'').trim();
    const priority=$('techNewTicketPriority')?.value || 'normal';
    if(!projectId) return msg('اختر المشروع','err');
    if(!title) return msg('عنوان المشكلة مطلوب','err');
    const proj=(data.projects||[]).find(p=>String(p.id)===String(projectId));
    const now=new Date().toISOString();
    const row={
      project_id: projectId,
      supervisor_id: Number(proj?.supervisor_id)||null,
      created_by: u.id,
      title,
      description,
      priority,
      status:'open',
      updated_at: now
    };
    const res=await sb.from('tickets').insert(row).select('*').single();
    if(res.error) return msg(res.error.message,'err');
    if(res.data && !res.data.ticket_number){
      const tn='T-'+String(res.data.id).padStart(4,'0');
      await sb.from('tickets').update({ticket_number:tn}).eq('id',res.data.id);
      res.data.ticket_number=tn;
    }
    playAppSound('ticket');
    msg('تم رفع التكت بنجاح');
    clearTechnicianTicketForm();
    await loadAll();
    renderTechnicianTickets();
    // تجهيز رسالة واتساب بعد رفع التكت مباشرة
    setTimeout(()=>{ try{ (window.sendTicketWhatsAppV43||window.sendTicketWhatsApp)?.(res.data.id); }catch(e){} }, 300);
  };
  const _oldInitTech = window.initTechnician;
  window.initTechnician = async function(){
    const u=requireRole('technician'); if(!u) return;
    await loadAll();
    if($('techTitle')) $('techTitle').textContent='لوحة الفني - '+(u.full_name||u.username);
    if($('techNewTicketProject') && typeof fillSelect==='function') fillSelect('techNewTicketProject', data.projects||[], 'name', 'اختر المشروع');
    renderTechnicianTickets();
    if(!window.__techAutoRefreshV46){
      window.__techAutoRefreshV46=setInterval(async()=>{ await loadAll(); if($('techNewTicketProject') && typeof fillSelect==='function' && !$('techNewTicketProject').options.length) fillSelect('techNewTicketProject', data.projects||[], 'name', 'اختر المشروع'); renderTechnicianTickets(); }, 20000);
    }
  };
  const css=document.createElement('style');
  css.textContent='.wa-ticket-btn-v46{background:#128C7E!important;color:#fff!important;border:0!important;border-radius:10px!important;padding:8px 10px!important;line-height:1.25!important;min-width:105px!important;font-weight:700!important}.wa-ticket-btn-v46 small{font-size:10px;color:#fff!important}.whatsapp-col{text-align:center!important;white-space:nowrap}.grid.two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}@media(max-width:760px){.grid.two{grid-template-columns:1fr}}';
  document.head.appendChild(css);
})();

/* ===== V47: Recalculate daily time logs when project required time changes ===== */

/* ===== V52: Professional daily manager PDF report ===== */
function reportEscV52(v){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function reportDateLabelV52(dateStr){
  if(!dateStr) return '-';
  try { return new Date(dateStr+'T00:00:00').toLocaleDateString('ar-SA',{weekday:'long',year:'numeric',month:'long',day:'numeric'}); }
  catch(e){ return dateStr; }
}
function reportWorkersForProjectV52(projectId){
  const names = new Set();
  (data.workers||[]).forEach(w=>{
    const pid = (typeof workerProjectId==='function') ? workerProjectId(w) : (w.project_id || w.assigned_project_id || '');
    if(String(pid)===String(projectId) && (w.status||'active')!=='inactive') names.add(w.name);
  });
  return [...names].filter(Boolean).join('، ') || '-';
}
function reportTimeStatusValueV52(log, actual, required){
  const diff = actual - required;
  if(diff < -5) return 'under_time';
  if(diff > 5) return 'over_time';
  return 'within_time';
}
function reportStatusArabicV52(status){
  if(status==='under_time' || status==='ناقص وقت') return 'ناقص وقت';
  if(status==='over_time' || status==='زيادة وقت') return 'زيادة وقت';
  if(status==='within_time' || status==='ضمن الوقت') return 'ضمن الوقت';
  return (typeof timeStatusText==='function' ? timeStatusText(status) : (status||'-'));
}
function exportDailyManagerPDF(){
  const rows = (typeof filterLogs==='function' ? filterLogs() : (data.logs||[])).slice().sort((a,b)=>{
    const pa = projectName(a.project_id), pb = projectName(b.project_id);
    if(pa!==pb) return pa.localeCompare(pb,'ar');
    return new Date(a.check_in||a.log_date) - new Date(b.check_in||b.log_date);
  });
  const selectedDate = $('dailyDate')?.value || today();
  const selectedSupervisor = $('dailySupervisor')?.value ? supervisorName($('dailySupervisor').value) : 'الكل';
  const selectedProject = $('dailyProject')?.value ? projectName($('dailyProject').value) : 'الكل';
  if(!rows.length){ msg('لا توجد بيانات لتصدير التقرير اليومي','err'); return; }

  let totalActual=0, totalRequired=0, under=0, over=0, within=0;
  const tableRows = rows.map((l,idx)=>{
    const actual = Number(l.duration_minutes || minutesBetween(l.check_in,l.check_out));
    const required = Number((typeof logRequiredMinutes==='function' ? logRequiredMinutes(l) : l.required_minutes) || 0);
    const diff = actual - required;
    const status = reportTimeStatusValueV52(l, actual, required);
    totalActual += actual; totalRequired += required;
    if(status==='under_time') under++; else if(status==='over_time') over++; else within++;
    const cls = status==='under_time'?'bad':(status==='over_time'?'warn':'ok');
    const workers = reportWorkersForProjectV52(l.project_id);
    return `<tr>
      <td>${idx+1}</td>
      <td>${reportEscV52(supervisorName(l.supervisor_id))}</td>
      <td>${reportEscV52(projectName(l.project_id))}</td>
      <td>${reportEscV52(workers)}</td>
      <td>${reportEscV52(typeof visitTypeText==='function'?visitTypeText(l.visit_type):'')}</td>
      <td>${reportEscV52(timeOnly(l.check_in))}</td>
      <td>${reportEscV52(timeOnly(l.check_out))}</td>
      <td>${reportEscV52(minsToText(required))}</td>
      <td>${reportEscV52(minsToText(actual))}</td>
      <td>${reportEscV52(typeof diffText==='function'?diffText(diff):minsToText(Math.abs(diff)))}</td>
      <td><span class="pill ${cls}">${reportStatusArabicV52(status)}</span></td>
      <td>${reportEscV52(l.notes||'')}</td>
    </tr>`;
  }).join('');
  const totalDiff = totalActual-totalRequired;
  const generatedAt = new Date().toLocaleString('ar-SA');
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير يومي للمدير</title>
  <style>
    @page{size:A4 landscape;margin:12mm}
    *{box-sizing:border-box} body{font-family:Tahoma,Arial,sans-serif;color:#173b33;margin:0;background:#fff;font-size:12px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0b5b4a;padding-bottom:12px;margin-bottom:14px}
    .brand{font-size:22px;font-weight:800;color:#06483b}.sub{font-size:12px;color:#667;margin-top:4px}.title{text-align:left}.title h1{margin:0;font-size:20px;color:#0b5b4a}.title .date{margin-top:6px;color:#444}
    .meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.box{border:1px solid #d8e4df;border-radius:12px;padding:10px;background:#f8fbfa}.box b{display:block;color:#0b5b4a;margin-bottom:4px}
    .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:12px 0}.kpi{border-radius:14px;padding:10px;background:#eef7f4;border:1px solid #d4e8e1;text-align:center}.kpi strong{display:block;font-size:18px;color:#063f34}.kpi span{color:#596b66;font-size:11px}
    table{width:100%;border-collapse:collapse;margin-top:10px} th{background:#0b5b4a;color:#fff;padding:8px;border:1px solid #0b5b4a;font-size:11px}td{padding:7px;border:1px solid #dfe8e4;vertical-align:top;text-align:center}tbody tr:nth-child(even){background:#fafdfc}.pill{display:inline-block;padding:4px 8px;border-radius:999px;font-weight:700;font-size:11px}.ok{background:#e6f6ec;color:#116b32}.warn{background:#fff4d8;color:#8a5b00}.bad{background:#ffe5e5;color:#9c1d1d}
    .footer{margin-top:14px;display:flex;justify-content:space-between;color:#666;font-size:11px;border-top:1px solid #dfe8e4;padding-top:8px}.sign{margin-top:18px;display:grid;grid-template-columns:1fr 1fr;gap:20px}.sign div{height:55px;border:1px dashed #b9c9c3;border-radius:10px;padding:8px;color:#666}
    @media print{.no-print{display:none!important} body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  </style></head><body>
    <div class="header"><div><div class="brand">شركة تصنيف لإدارة المرافق</div><div class="sub">تقرير التشغيل اليومي للإدارة</div></div><div class="title"><h1>تقرير يومي للمدير</h1><div class="date">تاريخ التقرير: ${reportEscV52(reportDateLabelV52(selectedDate))}</div><div class="sub">وقت التصدير: ${reportEscV52(generatedAt)}</div></div></div>
    <div class="meta"><div class="box"><b>المشرف</b>${reportEscV52(selectedSupervisor)}</div><div class="box"><b>المشروع</b>${reportEscV52(selectedProject)}</div><div class="box"><b>عدد السجلات</b>${rows.length}</div><div class="box"><b>معد التقرير</b>لوحة الإدارة</div></div>
    <div class="kpis"><div class="kpi"><strong>${reportEscV52(minsToText(totalActual))}</strong><span>إجمالي الوقت الفعلي</span></div><div class="kpi"><strong>${reportEscV52(minsToText(totalRequired))}</strong><span>إجمالي الوقت المطلوب</span></div><div class="kpi"><strong>${reportEscV52((totalDiff>=0?'زيادة ':'نقص ')+minsToText(Math.abs(totalDiff)))}</strong><span>فرق الوقت</span></div><div class="kpi"><strong>${within}</strong><span>ضمن الوقت</span></div><div class="kpi"><strong>${over} / ${under}</strong><span>زيادة / نقص</span></div></div>
    <table><thead><tr><th>#</th><th>المشرف</th><th>المشروع</th><th>أسماء العمال</th><th>نوع الزيارة</th><th>الدخول</th><th>الخروج</th><th>المطلوب</th><th>الفعلي</th><th>الفرق</th><th>الحالة</th><th>ملاحظات</th></tr></thead><tbody>${tableRows}</tbody></table>
    <div class="sign"><div>اعتماد مدير التشغيل:</div><div>ملاحظات المدير:</div></div>
    <div class="footer"><span>شركة تصنيف لإدارة المرافق</span><span>هذا التقرير مولّد آليًا من نظام التشغيل</span></div>
    <script>window.onload=function(){setTimeout(function(){window.print()},400)}</script>
  </body></html>`;
  const w = window.open('', '_blank');
  if(!w){ msg('المتصفح منع فتح نافذة التقرير. اسمح بالنوافذ المنبثقة','err'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

/* ===== V56: unique worker count + WhatsApp daily report ===== */
function tasneefNormNameV56(v){return String(v||'').trim().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ')}
function uniqueWorkersCountV56(){const s=new Set();(data.workers||[]).forEach(w=>{if(String(w.status||'active').toLowerCase()==='deleted')return;const n=tasneefNormNameV56(w.name);if(n)s.add(n)});return s.size}
(function(){const old=window.renderDashboard;window.renderDashboard=function(){if(typeof old==='function')old();const k=$('kpiWorkers');if(k)k.textContent=uniqueWorkersCountV56()}})();
function uniqueWorkersForProjectTextV56(projectId){const m=new Map();(data.workers||[]).forEach(w=>{const st=String(w.status||'active').toLowerCase();if(st==='deleted'||st==='inactive')return;const pid=(typeof workerProjectId==='function')?workerProjectId(w):(w.project_id||w.assigned_project_id||'');if(String(pid)!==String(projectId))return;const key=tasneefNormNameV56(w.name);if(key&&!m.has(key))m.set(key,String(w.name||'').trim())});return [...m.values()].join('، ')||'-'}
function dailyReportRowsV56(){return (typeof filterLogs==='function'?filterLogs():(data.logs||[])).slice().sort((a,b)=>{const pa=projectName(a.project_id),pb=projectName(b.project_id);if(pa!==pb)return pa.localeCompare(pb,'ar');return new Date(a.check_in||a.log_date)-new Date(b.check_in||b.log_date)})}
function dailyReportWhatsappTextV56(){const rows=dailyReportRowsV56();const date=$('dailyDate')?.value||today();const sup=$('dailySupervisor')?.value?supervisorName($('dailySupervisor').value):'الكل';const proj=$('dailyProject')?.value?projectName($('dailyProject').value):'الكل';let actualTotal=0,reqTotal=0,under=0,over=0,within=0;const lines=['تقرير التشغيل اليومي','شركة تصنيف','المسؤول: وائل شاكر','التاريخ: '+(typeof reportDateLabelV52==='function'?reportDateLabelV52(date):date),'المشرف: '+sup,'المشروع: '+proj,'عدد السجلات: '+rows.length,''];rows.forEach(l=>{const actual=Number(l.duration_minutes||minutesBetween(l.check_in,l.check_out));const req=Number((typeof logRequiredMinutes==='function'?logRequiredMinutes(l):l.required_minutes)||0);const diff=actual-req;actualTotal+=actual;reqTotal+=req;if(diff<-5)under++;else if(diff>5)over++;else within++});lines.push('الملخص:');lines.push('إجمالي الوقت الفعلي: '+minsToText(actualTotal));lines.push('إجمالي الوقت المطلوب: '+minsToText(reqTotal));lines.push('فرق الوقت: '+((actualTotal-reqTotal)>=0?'زيادة ':'نقص ')+minsToText(Math.abs(actualTotal-reqTotal)));lines.push('ضمن الوقت: '+within+' | زيادة: '+over+' | نقص: '+under);lines.push('');lines.push('تفاصيل السجلات:');rows.slice(0,40).forEach((l,i)=>{const actual=Number(l.duration_minutes||minutesBetween(l.check_in,l.check_out));const req=Number((typeof logRequiredMinutes==='function'?logRequiredMinutes(l):l.required_minutes)||0);const diff=actual-req;const st=diff<-5?'ناقص وقت':diff>5?'زيادة وقت':'ضمن الوقت';lines.push((i+1)+') '+projectName(l.project_id)+' | '+supervisorName(l.supervisor_id)+' | العمال: '+uniqueWorkersForProjectTextV56(l.project_id)+' | '+timeOnly(l.check_in)+' - '+timeOnly(l.check_out)+' | الفعلي '+minsToText(actual)+' | المطلوب '+minsToText(req)+' | '+st)});if(rows.length>40)lines.push('... وباقي السجلات موجودة في تقرير PDF.');lines.push('');lines.push('ملاحظة: احفظ التقرير PDF من زر الطباعة ثم أرفقه في الواتساب.');return lines.join('\n')}
function copyTextV56(text){if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(text);const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();return Promise.resolve()}
function sendDailyManagerWhatsapp(){const rows=dailyReportRowsV56();if(!rows.length){msg('لا توجد بيانات لإرسال التقرير','err');return}const text=dailyReportWhatsappTextV56();copyTextV56(text).finally(()=>{window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank');msg('تم تجهيز رسالة التقرير للواتساب. احفظ PDF من زر الطباعة وأرفقه في الواتساب.')})}

/* ===== V57: Monthly print/PDF report without records count ===== */
function monthLabelV57(month){try{const a=String(month||'').split('-').map(Number);return new Date(a[0],a[1]-1,1).toLocaleDateString('ar-SA',{year:'numeric',month:'long'});}catch(e){return month||'-'}}
function monthlyDiffTextV57(mins){mins=Number(mins||0);if(mins>5)return 'زيادة '+minsToText(Math.abs(mins));if(mins<-5)return 'نقص '+minsToText(Math.abs(mins));return 'ضمن الوقت'}
function monthlyReportRowsV57(){
  const month=$('monthlyMonth')?.value||today().slice(0,7), sid=$('monthlySupervisor')?.value||'';
  let logs=(data.logs||[]).filter(l=>{const d=l.log_date||String(l.check_in||'').slice(0,10);return d&&d.slice(0,7)===month});
  if(sid) logs=logs.filter(l=>String(l.supervisor_id)===String(sid));
  const map=new Map();
  logs.forEach(l=>{const k=(l.supervisor_id||'')+'_'+(l.project_id||'');if(!map.has(k))map.set(k,{s:l.supervisor_id,p:l.project_id,a:0,r:0});const x=map.get(k);x.a+=Number((typeof logActualMinutes==='function'?logActualMinutes(l):(l.duration_minutes||minutesBetween(l.check_in,l.check_out)))||0);x.r+=Number((typeof logRequiredMinutes==='function'?logRequiredMinutes(l):l.required_minutes)||0)});
  return [...map.values()].sort((a,b)=>{const s=supervisorName(a.s).localeCompare(supervisorName(b.s),'ar');return s||projectName(a.p).localeCompare(projectName(b.p),'ar')}).map(x=>{const diff=x.a-x.r;let st='غير محدد',cls='neutral';if(x.r>0){if(diff<-5){st='ناقص وقت';cls='bad'}else if(diff>5){st='زيادة وقت';cls='warn'}else{st='ضمن الوقت';cls='ok'}}return {...x,diff,st,cls,workers:(typeof uniqueWorkersForProjectTextV56==='function'?uniqueWorkersForProjectTextV56(x.p):'-')}})
}
function printMonthlyReportV57(){
  const rows=monthlyReportRowsV57(); if(!rows.length){msg('لا توجد بيانات في الأوقات الشهرية للطباعة','err');return}
  const month=$('monthlyMonth')?.value||today().slice(0,7), sup=$('monthlySupervisor')?.value?supervisorName($('monthlySupervisor').value):'الكل';
  let ta=0,tr=0,within=0,over=0,under=0;
  const trs=rows.map((r,i)=>{ta+=r.a;tr+=r.r;if(r.st==='ضمن الوقت')within++;else if(r.st==='زيادة وقت')over++;else if(r.st==='ناقص وقت')under++;return `<tr><td>${i+1}</td><td>${reportEscV52(supervisorName(r.s))}</td><td>${reportEscV52(projectName(r.p))}</td><td>${reportEscV52(r.workers||'-')}</td><td>${reportEscV52(minsToText(r.a))}</td><td>${reportEscV52(minsToText(r.r))}</td><td>${reportEscV52(monthlyDiffTextV57(r.diff))}</td><td><span class="pill ${r.cls}">${reportEscV52(r.st)}</span></td></tr>`}).join('');
  const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الأوقات الشهرية</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;margin:0;color:#163d34;font-size:12px}.page{border:2px solid #0a5a49;border-radius:18px;padding:14px;min-height:100vh;background:linear-gradient(135deg,rgba(10,90,73,.06),#fff 35%,rgba(191,156,86,.06))}.top{display:flex;justify-content:space-between;align-items:center;border-bottom:4px solid #0a5a49;padding-bottom:14px;margin-bottom:14px}.brand{display:flex;align-items:center;gap:12px}.logo{width:60px;height:60px;border:3px solid #c7a24d;border-radius:50%;display:grid;place-items:center;font-weight:900;color:#0a5a49}.brand h2,.title h1{margin:0;color:#0a5a49}.brand small,.title p{color:#6a766f}.title{text-align:left}.title h1{font-size:28px}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0}.box,.kpi,.panel{background:white;border:1px solid #d9e6e1;border-radius:16px;padding:11px;box-shadow:0 8px 18px rgba(0,0,0,.04)}.box b{display:block;color:#0a5a49;margin-bottom:5px}.box span{font-size:15px;font-weight:700}table{width:100%;border-collapse:separate;border-spacing:0;border-radius:16px;overflow:hidden;box-shadow:0 10px 24px rgba(0,0,0,.06)}th{background:#0a5a49;color:white;padding:10px}td{padding:9px;border-bottom:1px solid #e2ece8;text-align:center;background:#fff}tbody tr:nth-child(even) td{background:#f7fbfa}.pill{border-radius:999px;padding:5px 10px;font-weight:800;display:inline-block}.ok{background:#e5f6ec;color:#107338}.warn{background:#fff3d6;color:#8a5c00}.bad{background:#ffe5e5;color:#9d2020}.neutral{background:#edf1f4;color:#52616b}.section{text-align:center;margin:16px 0 12px}.section span{display:inline-block;background:#0a5a49;color:#fff;border:2px solid #c7a24d;border-radius:999px;padding:8px 36px;font-weight:900}.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:9px}.kpi{text-align:center}.kpi strong{display:block;color:#0a5a49;font-size:18px}.kpi span{font-size:11px;color:#6a766f}.bottom{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}.panel h3{margin:0 0 10px;color:#0a5a49}.line{height:24px;border-bottom:1px dashed #afbeb8}.footer{text-align:center;margin-top:12px;color:#697a73;border-top:1px solid #dce8e3;padding-top:8px}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.page{border-radius:0}}</style></head><body><div class="page"><div class="top"><div class="brand"><div class="logo">تصنيف</div><div><h2>شركة تصنيف</h2><small>إدارة المرافق والتشغيل</small></div></div><div class="title"><h1>تقرير الأوقات الشهرية</h1><p>المسؤول: وائل شاكر</p></div></div><div class="meta"><div class="box"><b>الشهر</b><span>${reportEscV52(monthLabelV57(month))}</span></div><div class="box"><b>المشرف</b><span>${reportEscV52(sup)}</span></div><div class="box"><b>عدد المشاريع</b><span>${rows.length}</span></div><div class="box"><b>وقت التصدير</b><span>${reportEscV52(new Date().toLocaleString('ar-SA'))}</span></div></div><table><thead><tr><th>#</th><th>المشرف</th><th>المشروع</th><th>أسماء العمال</th><th>إجمالي الوقت الفعلي</th><th>إجمالي الوقت المطلوب</th><th>فرق الوقت</th><th>حالة الوقت</th></tr></thead><tbody>${trs}</tbody></table><div class="section"><span>ملخص التقرير</span></div><div class="kpis"><div class="kpi"><strong>${reportEscV52(minsToText(ta))}</strong><span>إجمالي الساعات الفعلية</span></div><div class="kpi"><strong>${reportEscV52(minsToText(tr))}</strong><span>إجمالي الساعات المطلوبة</span></div><div class="kpi"><strong>${reportEscV52(monthlyDiffTextV57(ta-tr))}</strong><span>إجمالي فرق الوقت</span></div><div class="kpi"><strong>${within}</strong><span>ضمن الوقت</span></div><div class="kpi"><strong>${over}</strong><span>زيادة وقت</span></div><div class="kpi"><strong>${under}</strong><span>ناقص وقت</span></div></div><div class="bottom"><div class="panel"><h3>ملاحظات المدير</h3><div class="line"></div><div class="line"></div></div><div class="panel"><h3>اعتماد مدير التشغيل</h3><p>الاسم: وائل شاكر</p><div class="line">التوقيع:</div></div></div><div class="footer">هذا التقرير مولّد آليًا من نظام تصنيف — يحفظ PDF من نافذة الطباعة</div><script>window.onload=function(){setTimeout(function(){window.print()},400)}</script></div></body></html>`;
  const w=window.open('','_blank'); if(!w){msg('المتصفح منع فتح نافذة التقرير. اسمح بالنوافذ المنبثقة','err');return} w.document.open();w.document.write(html);w.document.close();
}

/* ===== V58: Monthly print like supervisor blocks with work percentage ===== */
function monthlyPercentClassV58(p){
  p=Number(p||0);
  if(!isFinite(p) || p<=0) return 'neutral';
  if(p>=95 && p<=105) return 'ok';
  if(p>105) return 'warn';
  return 'bad';
}
function monthlyStatusTextV58(p, req){
  p=Number(p||0); req=Number(req||0);
  if(!req) return 'غير محدد';
  if(p>=95 && p<=105) return 'ضمن الوقت';
  if(p>105) return 'زيادة وقت';
  return 'ناقص وقت';
}
function monthlyReportRowsV58(){
  const month=$('monthlyMonth')?.value||today().slice(0,7), sid=$('monthlySupervisor')?.value||'';
  let logs=(data.logs||[]).filter(l=>{const d=l.log_date||String(l.check_in||'').slice(0,10);return d&&d.slice(0,7)===month});
  if(sid) logs=logs.filter(l=>String(l.supervisor_id)===String(sid));
  const map=new Map();
  logs.forEach(l=>{
    const k=(l.supervisor_id||'')+'_'+(l.project_id||'');
    if(!map.has(k)) map.set(k,{s:l.supervisor_id,p:l.project_id,a:0,r:0,t:0});
    const x=map.get(k);
    x.a+=Number((typeof logActualMinutes==='function'?logActualMinutes(l):(l.duration_minutes||minutesBetween(l.check_in,l.check_out)))||0);
    x.r+=Number((typeof logRequiredMinutes==='function'?logRequiredMinutes(l):l.required_minutes)||0);
    x.t+=Number(l.travel_minutes||0);
  });
  return [...map.values()].sort((a,b)=>{const s=supervisorName(a.s).localeCompare(supervisorName(b.s),'ar');return s||projectName(a.p).localeCompare(projectName(b.p),'ar')}).map(x=>{
    const percent=x.r ? (x.a/x.r*100) : 0;
    const diff=x.a-x.r;
    const cls=monthlyPercentClassV58(percent);
    const st=monthlyStatusTextV58(percent,x.r);
    return {...x,percent,diff,cls,st,workers:(typeof uniqueWorkersForProjectTextV56==='function'?uniqueWorkersForProjectTextV56(x.p):'-')};
  });
}
function supervisorWorkersForMonthlyV58(supervisorId, rows){
  const names=new Set();
  rows.filter(r=>String(r.s)===String(supervisorId)).forEach(r=>{
    String(r.workers||'').split(/[،,]/).map(x=>x.trim()).filter(Boolean).forEach(n=>{if(n!=='-') names.add(n)});
  });
  if(!names.size){
    (data.workers||[]).filter(w=>String(workerSupId(w))===String(supervisorId)).forEach(w=>{if(w.name) names.add(w.name)});
  }
  return [...names].sort((a,b)=>a.localeCompare(b,'ar')).join('، ') || '-';
}
function printMonthlyReportV57(){
  const rows=monthlyReportRowsV58();
  if(!rows.length){msg('لا توجد بيانات في الأوقات الشهرية للطباعة','err');return}
  const month=$('monthlyMonth')?.value||today().slice(0,7), sup=$('monthlySupervisor')?.value?supervisorName($('monthlySupervisor').value):'الكل';
  let actualTotal=0, requiredTotal=0, within=0, over=0, under=0;
  rows.forEach(r=>{actualTotal+=r.a; requiredTotal+=r.r; if(r.st==='ضمن الوقت') within++; else if(r.st==='زيادة وقت') over++; else if(r.st==='ناقص وقت') under++;});
  const totalPct=requiredTotal ? actualTotal/requiredTotal*100 : 0;
  const groups=new Map();
  rows.forEach(r=>{const sid=String(r.s||''); if(!groups.has(sid)) groups.set(sid,[]); groups.get(sid).push(r);});
  const groupCards=[...groups.entries()].map(([sid,items])=>{
    const sActual=items.reduce((a,r)=>a+r.a,0), sReq=items.reduce((a,r)=>a+r.r,0), sPct=sReq?sActual/sReq*100:0;
    const projects=items.map(r=>`<tr><td class="pname">${reportEscV52(projectName(r.p))}</td><td>${reportEscV52(minsToText(r.a))}</td><td><span class="percent ${r.cls}">${reportEscV52(percentText(r.percent))}</span></td></tr>`).join('');
    return `<div class="super-card"><div class="super-head"><b>${reportEscV52(supervisorName(sid))}</b><span>${reportEscV52(percentText(sPct))}</span></div><table class="mini"><thead><tr><th>المشروع</th><th>الفعلي</th><th>نسبة العمل</th></tr></thead><tbody>${projects}</tbody></table><div class="workers"><b>أسماء العمال</b><p>${reportEscV52(supervisorWorkersForMonthlyV58(sid,rows))}</p></div></div>`;
  }).join('');
  const detailRows=rows.map(r=>`<tr><td>${reportEscV52(supervisorName(r.s))}</td><td>${reportEscV52(projectName(r.p))}</td><td>${reportEscV52(r.workers||'-')}</td><td>${reportEscV52(minsToText(r.a))}</td><td>${reportEscV52(minsToText(r.r))}</td><td>${reportEscV52(monthlyDiffTextV57(r.diff))}</td><td><span class="percent ${r.cls}">${reportEscV52(percentText(r.percent))}</span></td><td><span class="pill ${r.cls}">${reportEscV52(r.st)}</span></td></tr>`).join('');
  const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الأوقات الشهرية</title><style>
  @page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{margin:0;font-family:Tahoma,Arial,sans-serif;color:#123d32;background:#fff;font-size:11px}.page{min-height:100vh;padding:14px;background:radial-gradient(circle at top left,rgba(10,90,73,.10),transparent 32%),linear-gradient(135deg,#fff 0%,#fff 62%,rgba(199,162,77,.08));border:2px solid #0a5a49}.top{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #0a5a49;padding-bottom:10px;margin-bottom:10px}.brand{display:flex;align-items:center;gap:10px}.logo{width:54px;height:54px;border-radius:50%;border:3px solid #c7a24d;display:grid;place-items:center;font-weight:900;color:#0a5a49}.brand h2{margin:0;font-size:19px;color:#0a5a49}.title{text-align:left}.title h1{margin:0;font-size:28px;color:#0a5a49}.title p{margin:4px 0 0;color:#68766e}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}.box{background:#fff;border:1px solid #d9e6e1;border-radius:13px;padding:9px;text-align:center}.box b{display:block;color:#63756d;font-size:10px}.box strong{font-size:16px;color:#0a5a49}.section{margin:12px 0 8px;text-align:center}.section span{display:inline-block;background:#0a5a49;color:#fff;border:2px solid #c7a24d;border-radius:999px;padding:7px 40px;font-weight:900}.super-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.super-card{background:#fff;border:2px solid #0a5a49;border-radius:10px;overflow:hidden;min-height:245px}.super-head{display:flex;justify-content:space-between;align-items:center;background:#f7fbfa;border-bottom:1px solid #d9e6e1;padding:7px 9px;color:#0a5a49}.super-head b{font-size:13px}.super-head span{font-weight:900}.mini,.details{width:100%;border-collapse:collapse}.mini th{background:#0a5a49;color:#fff;padding:6px;font-size:10px}.mini td{border-bottom:1px solid #e5eeee;padding:5px;text-align:center}.pname{text-align:right!important;font-weight:700}.workers{padding:8px;text-align:center}.workers b{display:block;color:#0a5a49;margin-bottom:5px}.workers p{margin:0;line-height:1.7;color:#243b34}.details{margin-top:8px;border-radius:10px;overflow:hidden}.details th{background:#0a5a49;color:#fff;padding:7px}.details td{border:1px solid #e0e8e5;padding:6px;text-align:center}.percent,.pill{display:inline-block;border-radius:999px;padding:3px 8px;font-weight:900}.ok{background:#e5f6ec;color:#107338}.warn{background:#fff3d6;color:#8a5c00}.bad{background:#ffe5e5;color:#9d2020}.neutral{background:#edf1f4;color:#52616b}.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-top:8px}.kpi{background:#fff;border:1px solid #d9e6e1;border-radius:13px;padding:9px;text-align:center}.kpi strong{display:block;color:#0a5a49;font-size:16px}.kpi span{font-size:10px;color:#68766e}.bottom{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.panel{background:#fff;border:1px solid #d9e6e1;border-radius:12px;padding:9px}.panel h3{margin:0 0 8px;color:#0a5a49}.line{height:22px;border-bottom:1px dashed #afbeb8}.footer{text-align:center;margin-top:8px;color:#6a766f}.avoid{break-inside:avoid}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.page{border-radius:0}.super-card,.kpi,.panel{break-inside:avoid}}
  </style></head><body><div class="page"><div class="top"><div class="brand"><div class="logo">تصنيف</div><div><h2>شركة تصنيف</h2><small>إدارة المرافق والتشغيل</small></div></div><div class="title"><h1>تقرير الأوقات الشهرية</h1><p>المسؤول: وائل شاكر</p></div></div><div class="meta"><div class="box"><b>الشهر</b><strong>${reportEscV52(monthLabelV57(month))}</strong></div><div class="box"><b>المشرف</b><strong>${reportEscV52(sup)}</strong></div><div class="box"><b>عدد المشاريع</b><strong>${rows.length}</strong></div><div class="box"><b>نسبة العمل الإجمالية</b><strong>${reportEscV52(percentText(totalPct))}</strong></div></div><div class="section"><span>ملخص المشرفين والمشاريع</span></div><div class="super-grid avoid">${groupCards}</div><div class="section"><span>تفاصيل الأوقات الشهرية</span></div><table class="details"><thead><tr><th>المشرف</th><th>المشروع</th><th>أسماء العمال</th><th>الوقت الفعلي</th><th>الوقت المطلوب</th><th>الفرق</th><th>نسبة العمل</th><th>حالة الوقت</th></tr></thead><tbody>${detailRows}</tbody></table><div class="section"><span>ملخص التقرير</span></div><div class="kpis"><div class="kpi"><strong>${reportEscV52(minsToText(actualTotal))}</strong><span>إجمالي الوقت الفعلي</span></div><div class="kpi"><strong>${reportEscV52(minsToText(requiredTotal))}</strong><span>إجمالي الوقت المطلوب</span></div><div class="kpi"><strong>${reportEscV52(monthlyDiffTextV57(actualTotal-requiredTotal))}</strong><span>إجمالي فرق الوقت</span></div><div class="kpi"><strong>${reportEscV52(percentText(totalPct))}</strong><span>نسبة العمل</span></div><div class="kpi"><strong>${over}</strong><span>زيادة وقت</span></div><div class="kpi"><strong>${under}</strong><span>ناقص وقت</span></div></div><div class="bottom"><div class="panel"><h3>ملاحظات المدير</h3><div class="line"></div><div class="line"></div></div><div class="panel"><h3>اعتماد مدير التشغيل</h3><p>الاسم: وائل شاكر</p><div class="line">التوقيع:</div></div></div><div class="footer">هذا التقرير مولّد آليًا من نظام تصنيف — يحفظ PDF من نافذة الطباعة</div><script>window.onload=function(){setTimeout(function(){window.print()},400)}</script></div></body></html>`;
  const w=window.open('','_blank'); if(!w){msg('المتصفح منع فتح نافذة التقرير. اسمح بالنوافذ المنبثقة','err');return} w.document.open();w.document.write(html);w.document.close();
}

/* ===== V59: Monthly work percentage formula like Excel =====
   نسبة العمل = وقت المشروع الفعلي ÷ إجمالي وقت نفس المشرف × 100
   نسبة الالتزام = الوقت الفعلي ÷ الوقت المطلوب × 100
   حالة الوقت = حسب فرق الدقائق ±5
*/
function monthlyTimeClassV59(diff, required){
  if(!Number(required||0)) return 'neutral';
  diff=Number(diff||0);
  if(diff < -5) return 'bad';
  if(diff > 5) return 'warn';
  return 'ok';
}
function monthlyTimeStatusV59(diff, required){
  if(!Number(required||0)) return 'غير محدد';
  diff=Number(diff||0);
  if(diff < -5) return 'ناقص وقت';
  if(diff > 5) return 'زيادة وقت';
  return 'ضمن الوقت';
}
function monthlyCommitmentClassV59(percent, required){
  if(!Number(required||0)) return 'neutral';
  percent=Number(percent||0);
  if(percent>=95 && percent<=105) return 'ok';
  if(percent>105) return 'warn';
  return 'bad';
}
function monthlyBaseRowsV59(){
  const month=$('monthlyMonth')?.value||today().slice(0,7), sid=$('monthlySupervisor')?.value||'';
  let logs=(data.logs||[]).filter(l=>{const d=l.log_date||String(l.check_in||'').slice(0,10);return d&&d.slice(0,7)===month});
  if(sid) logs=logs.filter(l=>String(l.supervisor_id)===String(sid));
  const map=new Map();
  logs.forEach(l=>{
    const k=(l.supervisor_id||'')+'_'+(l.project_id||'');
    if(!map.has(k)) map.set(k,{s:l.supervisor_id,p:l.project_id,c:0,a:0,r:0,t:0});
    const x=map.get(k);
    x.c++;
    x.a+=Number((typeof logActualMinutes==='function'?logActualMinutes(l):(l.duration_minutes||minutesBetween(l.check_in,l.check_out)))||0);
    x.r+=Number((typeof logRequiredMinutes==='function'?logRequiredMinutes(l):l.required_minutes)||0);
    x.t+=Number(l.travel_minutes||0);
  });
  const vals=[...map.values()];
  const supTotals={};
  vals.forEach(r=>{ const s=String(r.s||''); supTotals[s]=(supTotals[s]||0)+Number(r.a||0); });
  return vals.map(r=>{
    const supTotal=supTotals[String(r.s||'')]||0;
    const workPercent=supTotal ? (r.a/supTotal*100) : 0;
    const commitmentPercent=r.r ? (r.a/r.r*100) : 0;
    const diff=r.a-r.r;
    const cls=monthlyTimeClassV59(diff,r.r);
    const st=monthlyTimeStatusV59(diff,r.r);
    const ccls=monthlyCommitmentClassV59(commitmentPercent,r.r);
    return {...r,supTotal,workPercent,commitmentPercent,diff,cls,st,ccls,workers:(typeof uniqueWorkersForProjectTextV56==='function'?uniqueWorkersForProjectTextV56(r.p):'-')};
  }).sort((a,b)=>{const s=supervisorName(a.s).localeCompare(supervisorName(b.s),'ar');return s||projectName(a.p).localeCompare(projectName(b.p),'ar')});
}
function renderMonthly(){
  const body=$('monthlyBody');
  if(!body) return;
  const vals=monthlyBaseRowsV59();
  body.innerHTML=vals.map(r=>`<tr><td>${esc(supervisorName(r.s))}</td><td>${esc(projectName(r.p))}</td><td>${r.c}</td><td>${minsToText(r.r)}</td><td>${minsToText(r.a)}</td><td>${r.t} دقيقة</td><td><span class="badge green">${percentText(r.workPercent)}</span></td><td><span class="badge ${r.ccls}">${percentText(r.commitmentPercent)}</span></td><td><span class="badge ${r.cls}">${r.st}</span></td></tr>`).join('')||'<tr><td colspan="9">لا توجد بيانات</td></tr>';
  const total=vals.reduce((a,r)=>a+r.a,0), required=vals.reduce((a,r)=>a+r.r,0), travel=vals.reduce((a,r)=>a+r.t,0), commitment=required?total/required*100:0;
  const diff=total-required, cls=monthlyTimeClassV59(diff,required), status=monthlyTimeStatusV59(diff,required);
  if($('monthlySummary')) $('monthlySummary').innerHTML=`<div class="kpi"><small>الساعات المطلوبة</small><b>${minsToText(required)}</b></div><div class="kpi"><small>الساعات الفعلية</small><b>${minsToText(total)}</b></div><div class="kpi"><small>فرق الوقت</small><b>${monthlyDiffTextV57(diff)}</b></div><div class="kpi"><small>وقت الانتقال</small><b>${travel} دقيقة</b></div><div class="kpi"><small>نسبة الالتزام</small><b>${percentText(commitment)}</b></div><div class="kpi"><small>حالة الأداء</small><b><span class="badge ${cls}">${status}</span></b></div>`;
}
function exportMonthlyCSV(){
  const rows=[...document.querySelectorAll('#monthlyBody tr')].map(tr=>[...tr.children].map(td=>td.textContent.trim()));
  const csv=['المشرف,المشروع,عدد السجلات,الساعات المطلوبة,الساعات الفعلية,وقت الانتقال,نسبة العمل,نسبة الالتزام,حالة الوقت',...rows.map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(','))].join('\n');
  download('monthly.csv',csv);
}
function monthlyReportRowsV58(){ return monthlyBaseRowsV59(); }
function supervisorWorkersForMonthlyV58(supervisorId, rows){
  const names=new Set();
  rows.filter(r=>String(r.s)===String(supervisorId)).forEach(r=>{
    String(r.workers||'').split(/[،,]/).map(x=>x.trim()).filter(Boolean).forEach(n=>{if(n!=='-') names.add(n)});
  });
  if(!names.size){
    (data.workers||[]).filter(w=>String(workerSupId(w))===String(supervisorId)).forEach(w=>{if(w.name) names.add(w.name)});
  }
  return [...names].sort((a,b)=>a.localeCompare(b,'ar')).join('، ') || '-';
}
function printMonthlyReportV57(){
  const rows=monthlyBaseRowsV59();
  if(!rows.length){msg('لا توجد بيانات في الأوقات الشهرية للطباعة','err');return}
  const month=$('monthlyMonth')?.value||today().slice(0,7), sup=$('monthlySupervisor')?.value?supervisorName($('monthlySupervisor').value):'الكل';
  let actualTotal=0, requiredTotal=0, within=0, over=0, under=0;
  rows.forEach(r=>{actualTotal+=r.a; requiredTotal+=r.r; if(r.st==='ضمن الوقت') within++; else if(r.st==='زيادة وقت') over++; else if(r.st==='ناقص وقت') under++;});
  const commitmentTotal=requiredTotal ? actualTotal/requiredTotal*100 : 0;
  const groups=new Map();
  rows.forEach(r=>{const sid=String(r.s||''); if(!groups.has(sid)) groups.set(sid,[]); groups.get(sid).push(r);});
  const groupCards=[...groups.entries()].map(([sid,items])=>{
    const sActual=items.reduce((a,r)=>a+r.a,0), sReq=items.reduce((a,r)=>a+r.r,0), sCommit=sReq?sActual/sReq*100:0;
    const projects=items.map(r=>`<tr><td class="pname">${reportEscV52(projectName(r.p))}</td><td>${reportEscV52(minsToText(r.a))}</td><td><span class="percent ok">${reportEscV52(percentText(r.workPercent))}</span></td></tr>`).join('');
    return `<div class="super-card"><div class="super-head"><b>${reportEscV52(supervisorName(sid))}</b><span>${reportEscV52(minsToText(sActual))}</span></div><table class="mini"><thead><tr><th>المشروع</th><th>الفعلي</th><th>نسبة العمل</th></tr></thead><tbody>${projects}</tbody></table><div class="workers"><b>أسماء العمال</b><p>${reportEscV52(supervisorWorkersForMonthlyV58(sid,rows))}</p></div><div class="commitment">نسبة الالتزام: <b>${reportEscV52(percentText(sCommit))}</b></div></div>`;
  }).join('');
  const detailRows=rows.map(r=>`<tr><td>${reportEscV52(supervisorName(r.s))}</td><td>${reportEscV52(projectName(r.p))}</td><td>${reportEscV52(r.workers||'-')}</td><td>${reportEscV52(minsToText(r.a))}</td><td>${reportEscV52(minsToText(r.r))}</td><td>${reportEscV52(monthlyDiffTextV57(r.diff))}</td><td><span class="percent ok">${reportEscV52(percentText(r.workPercent))}</span></td><td><span class="percent ${r.ccls}">${reportEscV52(percentText(r.commitmentPercent))}</span></td><td><span class="pill ${r.cls}">${reportEscV52(r.st)}</span></td></tr>`).join('');
  const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الأوقات الشهرية</title><style>@page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{margin:0;font-family:Tahoma,Arial,sans-serif;color:#123d32;background:#fff;font-size:11px}.page{min-height:100vh;padding:14px;background:radial-gradient(circle at top left,rgba(10,90,73,.10),transparent 32%),linear-gradient(135deg,#fff 0%,#fff 62%,rgba(199,162,77,.08));border:2px solid #0a5a49}.top{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #0a5a49;padding-bottom:10px;margin-bottom:10px}.brand{display:flex;align-items:center;gap:10px}.logo{width:54px;height:54px;border-radius:50%;border:3px solid #c7a24d;display:grid;place-items:center;font-weight:900;color:#0a5a49}.brand h2{margin:0;font-size:19px;color:#0a5a49}.title{text-align:left}.title h1{margin:0;font-size:28px;color:#0a5a49}.title p{margin:4px 0 0;color:#68766e}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}.box{background:#fff;border:1px solid #d9e6e1;border-radius:13px;padding:9px;text-align:center}.box b{display:block;color:#63756d;font-size:10px}.box strong{font-size:16px;color:#0a5a49}.section{margin:12px 0 8px;text-align:center}.section span{display:inline-block;background:#0a5a49;color:#fff;border:2px solid #c7a24d;border-radius:999px;padding:7px 40px;font-weight:900}.super-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.super-card{background:#fff;border:2px solid #0a5a49;border-radius:10px;overflow:hidden;min-height:245px}.super-head{display:flex;justify-content:space-between;align-items:center;background:#f7fbfa;border-bottom:1px solid #d9e6e1;padding:7px 9px;color:#0a5a49}.super-head b{font-size:13px}.super-head span{font-weight:900}.mini,.details{width:100%;border-collapse:collapse}.mini th{background:#0a5a49;color:#fff;padding:6px;font-size:10px}.mini td{border-bottom:1px solid #e5eeee;padding:5px;text-align:center}.pname{text-align:right!important;font-weight:700}.workers{padding:8px;text-align:center}.workers b{display:block;color:#0a5a49;margin-bottom:5px}.workers p{margin:0;line-height:1.7;color:#243b34}.commitment{padding:7px;text-align:center;border-top:1px solid #e5eeee;color:#0a5a49}.details{margin-top:8px;border-radius:10px;overflow:hidden}.details th{background:#0a5a49;color:#fff;padding:7px}.details td{border:1px solid #e0e8e5;padding:6px;text-align:center}.percent,.pill{display:inline-block;border-radius:999px;padding:3px 8px;font-weight:900}.ok{background:#e5f6ec;color:#107338}.warn{background:#fff3d6;color:#8a5c00}.bad{background:#ffe5e5;color:#9d2020}.neutral{background:#edf1f4;color:#52616b}.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-top:8px}.kpi{background:#fff;border:1px solid #d9e6e1;border-radius:13px;padding:9px;text-align:center}.kpi strong{display:block;color:#0a5a49;font-size:16px}.kpi span{font-size:10px;color:#68766e}.bottom{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.panel{background:#fff;border:1px solid #d9e6e1;border-radius:12px;padding:9px}.panel h3{margin:0 0 8px;color:#0a5a49}.line{height:22px;border-bottom:1px dashed #afbeb8}.footer{text-align:center;margin-top:8px;color:#6a766f}.avoid{break-inside:avoid}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.page{border-radius:0}.super-card,.kpi,.panel{break-inside:avoid}}</style></head><body><div class="page"><div class="top"><div class="brand"><div class="logo">تصنيف</div><div><h2>شركة تصنيف</h2><small>إدارة المرافق والتشغيل</small></div></div><div class="title"><h1>تقرير الأوقات الشهرية</h1><p>المسؤول: وائل شاكر</p></div></div><div class="meta"><div class="box"><b>الشهر</b><strong>${reportEscV52(monthLabelV57(month))}</strong></div><div class="box"><b>المشرف</b><strong>${reportEscV52(sup)}</strong></div><div class="box"><b>عدد المشاريع</b><strong>${rows.length}</strong></div><div class="box"><b>نسبة الالتزام الإجمالية</b><strong>${reportEscV52(percentText(commitmentTotal))}</strong></div></div><div class="section"><span>ملخص المشرفين والمشاريع</span></div><div class="super-grid avoid">${groupCards}</div><div class="section"><span>تفاصيل الأوقات الشهرية</span></div><table class="details"><thead><tr><th>المشرف</th><th>المشروع</th><th>أسماء العمال</th><th>الوقت الفعلي</th><th>الوقت المطلوب</th><th>الفرق</th><th>نسبة العمل</th><th>نسبة الالتزام</th><th>حالة الوقت</th></tr></thead><tbody>${detailRows}</tbody></table><div class="section"><span>ملخص التقرير</span></div><div class="kpis"><div class="kpi"><strong>${reportEscV52(minsToText(actualTotal))}</strong><span>إجمالي الوقت الفعلي</span></div><div class="kpi"><strong>${reportEscV52(minsToText(requiredTotal))}</strong><span>إجمالي الوقت المطلوب</span></div><div class="kpi"><strong>${reportEscV52(monthlyDiffTextV57(actualTotal-requiredTotal))}</strong><span>إجمالي فرق الوقت</span></div><div class="kpi"><strong>${reportEscV52(percentText(commitmentTotal))}</strong><span>نسبة الالتزام</span></div><div class="kpi"><strong>${over}</strong><span>زيادة وقت</span></div><div class="kpi"><strong>${under}</strong><span>ناقص وقت</span></div></div><div class="bottom"><div class="panel"><h3>ملاحظات المدير</h3><div class="line"></div><div class="line"></div></div><div class="panel"><h3>اعتماد مدير التشغيل</h3><p>الاسم: وائل شاكر</p><div class="line">التوقيع:</div></div></div><div class="footer">ملاحظة: نسبة العمل = وقت المشروع ÷ إجمالي وقت المشرف. نسبة الالتزام = الوقت الفعلي ÷ الوقت المطلوب.</div><script>window.onload=function(){setTimeout(function(){window.print()},400)}</script></div></body></html>`;
  const w=window.open('','_blank'); if(!w){msg('المتصفح منع فتح نافذة التقرير. اسمح بالنوافذ المنبثقة','err');return} w.document.open();w.document.write(html);w.document.close();
}

/* ===== V60: Correct monthly percentages and unique workers count ===== */
function tasneefNormNameV60(name){return String(name||'').trim().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ')}
function uniqueWorkersCountV60(){const set=new Set();(data.workers||[]).forEach(w=>{const st=String(w.status||'active').toLowerCase();if(st==='deleted')return;const key=tasneefNormNameV60(w.name);if(key)set.add(key)});return set.size}
function uniqueWorkersForProjectTextV60(projectId){const m=new Map();(data.workers||[]).forEach(w=>{const st=String(w.status||'active').toLowerCase();if(st==='deleted'||st==='inactive')return;const pid=(typeof workerProjectId==='function')?workerProjectId(w):(w.project_id||w.assigned_project_id||'');if(String(pid)!==String(projectId))return;const key=tasneefNormNameV60(w.name);if(key&&!m.has(key))m.set(key,String(w.name||'').trim())});return [...m.values()].join('، ')||'-'}
function renderDashboard(){if(!$('kpiUsers'))return;$('kpiUsers').textContent=data.users.length;$('kpiProjects').textContent=data.projects.length;$('kpiWorkers').textContent=uniqueWorkersCountV60();$('kpiTodayLogs').textContent=data.logs.filter(l=>(l.log_date||String(l.check_in||'').slice(0,10))===today()).length;const div=$('todaySummary');if(div)div.innerHTML=data.supervisors.map(s=>{const logs=data.logs.filter(l=>String(l.supervisor_id)===String(s.id)&&(l.log_date||String(l.check_in||'').slice(0,10))===today());const mins=logs.reduce((a,l)=>a+(Number(l.duration_minutes)||minutesBetween(l.check_in,l.check_out)),0);return `<div class="summary-item"><b>${esc(s.full_name)}</b><br>عدد التسجيلات: ${logs.length}<br>إجمالي الوقت: ${minsToText(mins)}</div>`}).join('')||'<div class="summary-item">لا توجد تسجيلات اليوم</div>'}
function monthlyStatusFromDiffV60(diff,required){if(!Number(required||0))return{text:'غير محدد',cls:'neutral'};diff=Number(diff||0);if(diff<-5)return{text:'ناقص وقت',cls:'bad'};if(diff>5)return{text:'زيادة وقت',cls:'warn'};return{text:'ضمن الوقت',cls:'ok'}}
function monthlyCommitmentClassV60(percent,required){if(!Number(required||0))return'neutral';percent=Number(percent||0);if(percent>=95&&percent<=105)return'ok';if(percent>105)return'warn';return'bad'}
function monthlyRowsV60(){const month=$('monthlyMonth')?.value||today().slice(0,7);const sid=$('monthlySupervisor')?.value;let logs=(data.logs||[]).filter(l=>{const d=l.log_date||String(l.check_in||'').slice(0,10);return d&&d.slice(0,7)===month});if(sid)logs=logs.filter(l=>String(l.supervisor_id)===String(sid));const map=new Map();logs.forEach(l=>{const k=String(l.supervisor_id||'')+'_'+String(l.project_id||'');if(!map.has(k))map.set(k,{s:l.supervisor_id,p:l.project_id,a:0,r:0,t:0});const x=map.get(k);x.a+=Number((typeof logActualMinutes==='function'?logActualMinutes(l):(l.duration_minutes||minutesBetween(l.check_in,l.check_out)))||0);x.r+=Number((typeof logRequiredMinutes==='function'?logRequiredMinutes(l):l.required_minutes)||0);x.t+=Number(l.travel_minutes||0)});const vals=[...map.values()];const supTotals={};vals.forEach(r=>{const s=String(r.s||'');supTotals[s]=(supTotals[s]||0)+Number(r.a||0)});return vals.map(r=>{const supTotal=supTotals[String(r.s||'')]||0;const workPercent=supTotal?(r.a/supTotal*100):0;const commitmentPercent=r.r?(r.a/r.r*100):0;const diff=r.a-r.r;const st=monthlyStatusFromDiffV60(diff,r.r);return{...r,supTotal,workers:uniqueWorkersForProjectTextV60(r.p),workPercent,commitmentPercent,ccls:monthlyCommitmentClassV60(commitmentPercent,r.r),diff,st:st.text,cls:st.cls}}).sort((a,b)=>{const s=supervisorName(a.s).localeCompare(supervisorName(b.s),'ar');return s||projectName(a.p).localeCompare(projectName(b.p),'ar')})}
function renderMonthly(){const body=$('monthlyBody');if(!body)return;const table=body.closest('table');if(table&&table.tHead)table.tHead.innerHTML='<tr><th>المشرف</th><th>المشروع</th><th>أسماء العمال</th><th>الساعات المطلوبة</th><th>الساعات الفعلية</th><th>وقت الانتقال</th><th>نسبة العمل</th><th>نسبة الالتزام</th><th>حالة الأداء</th></tr>';const vals=monthlyRowsV60();body.innerHTML=vals.map(r=>`<tr><td>${esc(supervisorName(r.s))}</td><td>${esc(projectName(r.p))}</td><td>${esc(r.workers)}</td><td>${minsToText(r.r)}</td><td>${minsToText(r.a)}</td><td>${r.t} دقيقة</td><td><span class="badge green">${percentText(r.workPercent)}</span></td><td><span class="badge ${r.ccls}">${percentText(r.commitmentPercent)}</span></td><td><span class="badge ${r.cls}">${r.st}</span></td></tr>`).join('')||'<tr><td colspan="9">لا توجد بيانات</td></tr>';const total=vals.reduce((a,r)=>a+r.a,0),required=vals.reduce((a,r)=>a+r.r,0),travel=vals.reduce((a,r)=>a+r.t,0),commitment=required?total/required*100:0;const diff=total-required,st=monthlyStatusFromDiffV60(diff,required);if($('monthlySummary'))$('monthlySummary').innerHTML=`<div class="kpi"><small>الساعات المطلوبة</small><b>${minsToText(required)}</b></div><div class="kpi"><small>الساعات الفعلية</small><b>${minsToText(total)}</b></div><div class="kpi"><small>فرق الوقت</small><b>${monthlyDiffTextV57(diff)}</b></div><div class="kpi"><small>وقت الانتقال</small><b>${travel} دقيقة</b></div><div class="kpi"><small>نسبة الالتزام</small><b>${percentText(commitment)}</b></div><div class="kpi"><small>حالة الأداء</small><b><span class="badge ${st.cls}">${st.text}</span></b></div>`}
function exportMonthlyCSV(){const rows=[...document.querySelectorAll('#monthlyBody tr')].map(tr=>[...tr.children].map(td=>td.textContent.trim()));const csv=['المشرف,المشروع,أسماء العمال,الساعات المطلوبة,الساعات الفعلية,وقت الانتقال,نسبة العمل,نسبة الالتزام,حالة الأداء',...rows.map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(','))].join('\n');download('monthly.csv',csv)}
function monthlyBaseRowsV59(){return monthlyRowsV60()}
function monthlyReportRowsV58(){return monthlyRowsV60()}

/* ===== V61: حماية السجلات + السجلات المفتوحة + رحلة التشغيل ===== */
(function(){
  const OLD_DELETE_ROW_V61 = window.deleteRow;
  function normDateV61(v){ return v || today(); }
  function logDayV61(l){ return l.log_date || String(l.check_in||l.created_at||'').slice(0,10); }
  function logActualV61(l){
    if(typeof logActualMinutes==='function') return Number(logActualMinutes(l)||0);
    const saved=Number(l.duration_minutes||0); if(saved>0) return saved;
    if(typeof minutesBetween==='function') return minutesBetween(l.check_in,l.check_out);
    if(!l.check_in||!l.check_out) return 0;
    return Math.max(0, Math.round((new Date(l.check_out)-new Date(l.check_in))/60000));
  }
  function hmToMinutesV61(t){ if(!t) return null; const parts=String(t).split(':').map(Number); if(parts.length<2||!Number.isFinite(parts[0])||!Number.isFinite(parts[1])) return null; return parts[0]*60+parts[1]; }
  function minutesRangeV61(start,end){ const a=hmToMinutesV61(start), b=hmToMinutesV61(end); if(a===null||b===null) return 0; return b>=a?b-a:(b+1440)-a; }
  function fmtMinsV61(mins){ return typeof minsToText==='function'?minsToText(mins):String(mins)+' د'; }
  function openLogsForDateV61(dateStr){
    return (data.logs||[]).filter(l=>logDayV61(l)===dateStr && l.check_in && !l.check_out);
  }
  function insertOpenLogsDashboardV61(){
    const dash=document.getElementById('dashboard'); if(!dash) return;
    let box=document.getElementById('openLogsDashboardV61');
    if(!box){
      box=document.createElement('div');
      box.id='openLogsDashboardV61';
      box.className='card';
      const anchor=document.getElementById('todaySummary')?.closest('.card') || dash.querySelector('.card') || dash;
      anchor.parentNode.insertBefore(box, anchor.nextSibling);
    }
    const date=today();
    const rows=openLogsForDateV61(date).sort((a,b)=>String(supervisorName(a.supervisor_id)).localeCompare(String(supervisorName(b.supervisor_id)),'ar'));
    const bySup={}; rows.forEach(l=>{const s=supervisorName(l.supervisor_id)||'غير محدد'; bySup[s]=(bySup[s]||0)+1;});
    const summary=Object.entries(bySup).map(([s,c])=>`<span class="badge amber" style="margin:3px">${esc(s)}: ${c}</span>`).join('');
    box.innerHTML=`<h2>السجلات المفتوحة اليوم</h2>
      <p class="footer-note">هذه سجلات دخول لم يتم تسجيل خروج لها بعد. لا يتم حذفها؛ فقط تظهر للتنبيه والمتابعة.</p>
      <div style="margin:8px 0">${summary || '<span class="badge green">لا توجد سجلات مفتوحة</span>'}</div>
      <div class="table-wrap" style="max-height:260px"><table><thead><tr><th>المشرف</th><th>المشروع</th><th>الدخول</th><th>التاريخ</th><th>إجراء</th></tr></thead><tbody>${rows.map(l=>`<tr><td>${esc(supervisorName(l.supervisor_id))}</td><td>${esc(projectName(l.project_id))}</td><td>${timeOnly(l.check_in)}</td><td>${esc(logDayV61(l))}</td><td><button class="light" onclick="editTimeLog(${l.id});showPage&&showPage('daily')">فتح السجل</button></td></tr>`).join('') || '<tr><td colspan="5">لا توجد سجلات مفتوحة</td></tr>'}</tbody></table></div>`;
  }
  const OLD_RENDER_DASHBOARD_V61 = window.renderDashboard;
  window.renderDashboard=function(){ if(typeof OLD_RENDER_DASHBOARD_V61==='function') OLD_RENDER_DASHBOARD_V61.apply(this,arguments); insertOpenLogsDashboardV61(); };

  window.deleteRow=async function(table,id){
    if(table==='time_logs'){
      const log=(data.logs||[]).find(x=>String(x.id)===String(id));
      const label=log?`${projectName(log.project_id)} - ${logDayV61(log)} - ${timeOnly(log.check_in)}`:String(id);
      const typed=prompt('حماية السجلات اليومية:\nلن يتم حذف السجل إلا بكتابة كلمة حذف يدويًا.\nالسجل: '+label+'\n\nاكتب: حذف يدويًا');
      if(typed!=='حذف يدويًا') return msg('تم إلغاء الحذف لحماية السجلات اليومية');
    }
    if(typeof OLD_DELETE_ROW_V61==='function') return OLD_DELETE_ROW_V61.apply(this,arguments);
  };

  function journeyKeyV61(date,sup){ return 'tasneef_journey_'+date+'_'+(sup||'all'); }
  function loadJourneyV61(date,sup){ try{return JSON.parse(localStorage.getItem(journeyKeyV61(date,sup))||'{}')}catch(e){return{}} }
  function saveJourneyV61(date,sup,row){ localStorage.setItem(journeyKeyV61(date,sup), JSON.stringify(row||{})); }
  function journeyLogsV61(date,sup){
    let rows=(data.logs||[]).filter(l=>logDayV61(l)===date && l.check_in && l.check_out);
    if(sup) rows=rows.filter(l=>String(l.supervisor_id)===String(sup));
    return rows;
  }
  function calcJourneyV61(date,sup,start,end){
    const total=minutesRangeV61(start,end);
    const work=journeyLogsV61(date,sup).reduce((a,l)=>a+logActualV61(l),0);
    const travel=Math.max(0,total-work);
    const productivity=total?Math.round(work/total*1000)/10:0;
    return {total,work,travel,productivity};
  }
  function ensureJourneyBoxV61(){
    const daily=document.getElementById('daily') || document.querySelector('.mobile-shell'); if(!daily) return;
    if(document.getElementById('journeyBoxV61')) return;
    const card=document.createElement('section');
    card.id='journeyBoxV61';
    card.className='card';
    card.innerHTML=`<h2>رحلة التشغيل اليومية</h2>
      <p class="footer-note">تحسب من خروج الفريق من السكن إلى رجوعه، وتقارنها بوقت العمل داخل المشاريع لمعرفة وقت التنقل والإنتاجية.</p>
      <div class="split">
        <div><label>التاريخ</label><input type="date" id="journeyDateV61"></div>
        <div><label>المشرف</label><select id="journeySupervisorV61"><option value="">الكل</option></select></div>
      </div>
      <div class="split">
        <div><label>وقت الخروج من السكن</label><input type="time" id="journeyStartV61"></div>
        <div><label>وقت الرجوع للسكن</label><input type="time" id="journeyEndV61"></div>
      </div>
      <div class="actions"><button type="button" onclick="saveJourneyV61()">حفظ وحساب</button><button type="button" class="light" onclick="renderJourneyV61()">تحديث الحساب</button></div>
      <div id="journeyResultV61" class="kpis small"></div>`;
    const target=document.getElementById('daily')?.querySelector('.card:nth-child(2)') || document.querySelector('.mobile-shell .card');
    if(target && target.parentNode) target.parentNode.insertBefore(card,target); else daily.appendChild(card);
    const sel=document.getElementById('journeySupervisorV61');
    if(sel && (data.supervisors||[]).length) sel.innerHTML='<option value="">الكل</option>'+(data.supervisors||[]).map(s=>`<option value="${s.id}">${esc(s.full_name)}</option>`).join('');
    const jd=document.getElementById('journeyDateV61'); if(jd) jd.value=today();
    ['journeyDateV61','journeySupervisorV61','journeyStartV61','journeyEndV61'].forEach(id=>{const el=document.getElementById(id); if(el) el.addEventListener('change',window.renderJourneyV61);});
    window.renderJourneyV61();
  }
  window.renderJourneyV61=function(){
    const date=document.getElementById('journeyDateV61')?.value||today();
    const sup=document.getElementById('journeySupervisorV61')?.value||'';
    const saved=loadJourneyV61(date,sup);
    const sEl=document.getElementById('journeyStartV61'), eEl=document.getElementById('journeyEndV61');
    if(sEl && !sEl.value && saved.start) sEl.value=saved.start;
    if(eEl && !eEl.value && saved.end) eEl.value=saved.end;
    const start=sEl?.value||saved.start||'', end=eEl?.value||saved.end||'';
    const c=calcJourneyV61(date,sup,start,end);
    const result=document.getElementById('journeyResultV61'); if(!result) return;
    result.innerHTML=`<div class="kpi"><small>إجمالي اليوم</small><b>${fmtMinsV61(c.total)}</b></div><div class="kpi"><small>داخل المشاريع</small><b>${fmtMinsV61(c.work)}</b></div><div class="kpi"><small>تنقل / ضائع</small><b>${fmtMinsV61(c.travel)}</b></div><div class="kpi"><small>نسبة الإنتاجية</small><b>${c.productivity}%</b></div>`;
  };
  window.saveJourneyV61=function(){
    const date=document.getElementById('journeyDateV61')?.value||today();
    const sup=document.getElementById('journeySupervisorV61')?.value||'';
    const start=document.getElementById('journeyStartV61')?.value||'';
    const end=document.getElementById('journeyEndV61')?.value||'';
    saveJourneyV61(date,sup,{start,end,updated_at:new Date().toISOString()});
    window.renderJourneyV61();
    msg('تم حفظ رحلة التشغيل لهذا اليوم');
  };
  const OLD_RENDER_ALL_V61=window.renderAll;
  window.renderAll=function(){ if(typeof OLD_RENDER_ALL_V61==='function') OLD_RENDER_ALL_V61.apply(this,arguments); setTimeout(()=>{ensureJourneyBoxV61(); insertOpenLogsDashboardV61();},100); };
  window.addEventListener('load',()=>setTimeout(()=>{ensureJourneyBoxV61(); insertOpenLogsDashboardV61();},800));
})();


/* ===== V62: WhatsApp messages use attendance/departure wording with supervisor and workers ===== */

/* ===== V64: WhatsApp for housing journey tied to logged-in supervisor account ===== */
(function(){
  function escV64(v){
    return String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function normNameV64(v){
    return String(v || '')
      .trim()
      .replace(/[أإآ]/g,'ا')
      .replace(/ى/g,'ي')
      .replace(/ة/g,'ه')
      .replace(/\s+/g,' ');
  }
  function currentUserV64(){
    try { return typeof session === 'function' ? session() : JSON.parse(localStorage.getItem('tasneef_user') || 'null'); }
    catch(e){ return null; }
  }
  function currentJourneySupervisorIdV64(){
    const u=currentUserV64();
    if(u && u.role === 'supervisor') return String(u.id);
    const sel=document.getElementById('journeySupervisorV61');
    return sel ? String(sel.value || '') : '';
  }
  function supervisorLabelV64(id){
    const u=currentUserV64();
    if(u && String(u.id)===String(id)) return u.full_name || u.username || 'المشرف';
    if(typeof supervisorName === 'function') return supervisorName(id) || 'المشرف';
    const s=(data.supervisors||[]).find(x=>String(x.id)===String(id));
    return s ? (s.full_name || s.username || 'المشرف') : 'المشرف';
  }
  function todayV64(){ return typeof today === 'function' ? today() : new Date().toISOString().slice(0,10); }
  function getSupervisorWorkersV64(supervisorId){
    const names=[];
    const projectIds=(data.projects||[])
      .filter(p => String(p.supervisor_id || '') === String(supervisorId))
      .map(p => String(p.id));
    (data.workers||[]).forEach(w=>{
      const bySupervisor = String(w.supervisor_id || '') === String(supervisorId) || String(w.app_supervisor_id || '') === String(supervisorId);
      const byProject = projectIds.includes(String(w.project_id || ''));
      if(bySupervisor || byProject){
        const n=String(w.name || w.full_name || '').trim();
        if(n) names.push(n);
      }
    });
    const seen=new Set();
    return names.filter(n=>{
      const key=normNameV64(n);
      if(!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function openWhatsappV64(text){
    const url='https://wa.me/?text=' + encodeURIComponent(text);
    let opened=null;
    try { opened=window.open(url, '_blank'); } catch(e){}
    try { if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text); } catch(e){}
    if(typeof msg === 'function'){
      msg(opened ? 'تم فتح واتساب وتجهيز الرسالة' : 'تم نسخ رسالة الواتساب، افتح واتساب والصقها');
    }
  }
  function buildJourneyWhatsappV64(type, supervisorId, date, timeValue){
    const workers=getSupervisorWorkersV64(supervisorId);
    const title = type === 'start' ? 'حضور المشرف وعماله' : 'انصراف المشرف وعماله';
    const timeLabel = type === 'start' ? 'وقت الخروج من السكن' : 'وقت الرجوع للسكن';
    return [
      title,
      '',
      'المشرف: ' + supervisorLabelV64(supervisorId),
      'أسماء العمال: ' + (workers.length ? workers.join('، ') : '-'),
      'التاريخ: ' + date,
      timeLabel + ': ' + (timeValue || '-'),
      '',
      'شركة تصنيف لإدارة المرافق'
    ].join('\n');
  }
  function lockJourneySupervisorForSupervisorV64(){
    const u=currentUserV64();
    const sel=document.getElementById('journeySupervisorV61');
    if(!sel || !u || u.role !== 'supervisor') return;
    sel.innerHTML = '<option value="'+escV64(u.id)+'">'+escV64(u.full_name || u.username || 'المشرف')+'</option>';
    sel.value = String(u.id);
    sel.disabled = true;
  }
  const oldRenderJourneyV64 = window.renderJourneyV61;
  window.renderJourneyV61 = function(){
    lockJourneySupervisorForSupervisorV64();
    if(typeof oldRenderJourneyV64 === 'function') return oldRenderJourneyV64.apply(this, arguments);
  };
  const oldSaveJourneyV64 = window.saveJourneyV61;
  window.saveJourneyV61 = function(){
    const u=currentUserV64();
    const date=document.getElementById('journeyDateV61')?.value || todayV64();
    let sup=currentJourneySupervisorIdV64();
    if(u && u.role === 'supervisor') sup=String(u.id);
    if(!sup){
      if(typeof msg==='function') msg('اختر مشرف محدد لإرسال رسالة واتساب','err');
      return;
    }
    const start=document.getElementById('journeyStartV61')?.value || '';
    const end=document.getElementById('journeyEndV61')?.value || '';
    let previous={};
    try{
      if(typeof loadJourneyV61 === 'function') previous = loadJourneyV61(date, sup) || {};
      else previous = JSON.parse(localStorage.getItem('tasneef_journey_'+date+'_'+sup) || '{}');
    }catch(e){ previous={}; }

    if(typeof oldSaveJourneyV64 === 'function') oldSaveJourneyV64.apply(this, arguments);

    // أرسل واتساب بناءً على الحقل الذي تم إدخاله/تغييره الآن.
    if(start && start !== previous.start){
      openWhatsappV64(buildJourneyWhatsappV64('start', sup, date, start));
    } else if(end && end !== previous.end){
      openWhatsappV64(buildJourneyWhatsappV64('end', sup, date, end));
    } else if(start && !end){
      openWhatsappV64(buildJourneyWhatsappV64('start', sup, date, start));
    } else if(end){
      openWhatsappV64(buildJourneyWhatsappV64('end', sup, date, end));
    }
  };
  const oldRenderAllV64=window.renderAll;
  window.renderAll=function(){
    if(typeof oldRenderAllV64 === 'function') oldRenderAllV64.apply(this, arguments);
    setTimeout(lockJourneySupervisorForSupervisorV64, 200);
  };
  window.addEventListener('load', ()=>setTimeout(lockJourneySupervisorForSupervisorV64, 900));
})();

/* ===== V65: Cloud daily journeys + fixed productivity + admin visibility ===== */
(function(){
  function uV65(){ try{return typeof session==='function'?session():JSON.parse(localStorage.getItem('tasneef_user')||'null')}catch(e){return null} }
  function escV65(v){ return String(v ?? '').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function todayV65(){ return typeof today==='function'?today():new Date().toISOString().slice(0,10); }
  function fmtMinsV65(m){ m=Math.max(0,Math.round(Number(m)||0)); const h=Math.floor(m/60), mm=m%60; return h+':'+String(mm).padStart(2,'0'); }
  function normV65(v){ return String(v||'').trim().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' '); }
  function localDateV65(date,time){ if(!date||!time) return null; return new Date(date+'T'+time+':00'); }
  function dateTimeIsoV65(date,time,plusDay){ const d=localDateV65(date,time); if(!d) return null; if(plusDay) d.setDate(d.getDate()+1); return d.toISOString(); }
  function rangeV65(date,start,end){
    const s=localDateV65(date,start), e=localDateV65(date,end);
    if(!s||!e) return {start:null,end:null,total:0,overnight:false};
    let overnight=false;
    if(e<s){ e.setDate(e.getDate()+1); overnight=true; }
    return {start:s,end:e,total:Math.max(0,Math.round((e-s)/60000)),overnight};
  }
  function logDayV65(l){ return l.log_date || String(l.check_in||'').slice(0,10); }
  function overlapMinutesV65(log, start, end){
    if(!log.check_in || !log.check_out || !start || !end) return 0;
    let a=new Date(log.check_in), b=new Date(log.check_out);
    if(b<a) b=new Date(b.getTime()+24*60*60000);
    const os=Math.max(a.getTime(), start.getTime());
    const oe=Math.min(b.getTime(), end.getTime());
    return Math.max(0, Math.round((oe-os)/60000));
  }
  function journeySupIdV65(){
    const u=uV65();
    if(u && u.role==='supervisor') return String(u.id);
    const sel=document.getElementById('journeySupervisorV61');
    return sel ? String(sel.value||'') : '';
  }
  function supervisorLabelV65(id){
    const u=uV65();
    if(u && String(u.id)===String(id)) return u.full_name || u.username || 'المشرف';
    try{ if(typeof supervisorName==='function') return supervisorName(id) || 'المشرف'; }catch(e){}
    const s=(data.supervisors||[]).find(x=>String(x.id)===String(id));
    return s ? (s.full_name||s.username||'المشرف') : 'المشرف';
  }
  function workersForSupervisorTextV65(supervisorId){
    const projectIds=new Set((data.projects||[]).filter(p=>String(p.supervisor_id||'')===String(supervisorId)).map(p=>String(p.id)));
    const names=[];
    (data.workers||[]).forEach(w=>{
      const ok=String(w.supervisor_id||'')===String(supervisorId) || String(w.app_supervisor_id||'')===String(supervisorId) || projectIds.has(String(w.project_id||''));
      if(ok && (w.name||w.full_name)) names.push(w.name||w.full_name);
    });
    const seen=new Set();
    const unique=names.filter(n=>{const k=normV65(n); if(!k||seen.has(k)) return false; seen.add(k); return true;});
    return unique.join('، ') || '-';
  }
  function calcJourneyV65(date, sup, startTime, endTime){
    const r=rangeV65(date,startTime,endTime);
    let logs=(data.logs||[]).filter(l=>logDayV65(l)===date && l.check_in && l.check_out);
    if(sup) logs=logs.filter(l=>String(l.supervisor_id)===String(sup));
    const work=logs.reduce((sum,l)=>sum+overlapMinutesV65(l,r.start,r.end),0);
    const safeWork=Math.min(work,r.total||0);
    const travel=Math.max(0,(r.total||0)-safeWork);
    const productivity=r.total?Math.min(100,Math.round((safeWork/r.total)*1000)/10):0;
    const conflict=work>r.total;
    return {total:r.total||0, work:safeWork, rawWork:work, travel, productivity, overnight:r.overnight, conflict};
  }
  function openWhatsappV65(text){
    let opened=null;
    try{ opened=window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank'); }catch(e){}
    try{ navigator.clipboard && navigator.clipboard.writeText && navigator.clipboard.writeText(text); }catch(e){}
    if(typeof msg==='function') msg(opened?'تم فتح واتساب وتجهيز الرسالة':'تم نسخ رسالة الواتساب، افتح واتساب والصقها');
  }
  function journeyMsgV65(type,sup,date,time){
    const title=type==='start'?'حضور المشرف وعماله':'انصراف المشرف وعماله';
    const label=type==='start'?'وقت الخروج من السكن':'وقت الرجوع للسكن';
    return [title,'','المشرف: '+supervisorLabelV65(sup),'أسماء العمال: '+workersForSupervisorTextV65(sup),'التاريخ: '+date,label+': '+(time||'-'),'','شركة تصنيف لإدارة المرافق'].join('\n');
  }
  async function fetchJourneyRowsV65(date,sup){
    try{
      let q=sb.from('daily_journeys').select('*').eq('journey_date',date).order('supervisor_id',{ascending:true});
      if(sup) q=q.eq('supervisor_id',Number(sup));
      const {data:rows,error}=await q;
      if(error) throw error;
      return rows||[];
    }catch(e){
      window.__journeyCloudErrorV65=e.message||String(e);
      return [];
    }
  }
  async function saveJourneyCloudV65(date,sup,start,end,calc){
    const r=rangeV65(date,start,end);
    const row={
      supervisor_id:Number(sup),
      journey_date:date,
      housing_out_time:start?dateTimeIsoV65(date,start,false):null,
      housing_return_time:end?dateTimeIsoV65(date,end,r.overnight):null,
      total_minutes:calc.total,
      project_minutes:calc.work,
      travel_minutes:calc.travel,
      productivity_percent:calc.productivity,
      updated_at:new Date().toISOString()
    };
    const user=uV65();
    if(user){ row.updated_by=user.id; if(!row.created_by) row.created_by=user.id; }
    const {error}=await sb.from('daily_journeys').upsert(row,{onConflict:'supervisor_id,journey_date'});
    if(error) throw error;
  }
  function lockSupervisorSelectV65(){
    const u=uV65(), sel=document.getElementById('journeySupervisorV61');
    if(!sel) return;
    if(u && u.role==='supervisor'){
      sel.innerHTML='<option value="'+escV65(u.id)+'">'+escV65(u.full_name||u.username||'المشرف')+'</option>';
      sel.value=String(u.id); sel.disabled=true;
    }else{
      sel.disabled=false;
      if(!sel.options.length || !sel.querySelector('option[value=""]')){
        sel.innerHTML='<option value="">الكل</option>'+(data.supervisors||[]).map(s=>'<option value="'+escV65(s.id)+'">'+escV65(s.full_name||s.username)+'</option>').join('');
      }
    }
  }
  function ensureJourneyExtrasV65(){
    const box=document.getElementById('journeyBoxV61');
    if(!box) return;
    if(!document.getElementById('journeySavedRowsV65')){
      const div=document.createElement('div');
      div.id='journeySavedRowsV65';
      div.className='table-wrap';
      div.style.marginTop='16px';
      div.innerHTML='<table><thead><tr><th>التاريخ</th><th>المشرف</th><th>خروج السكن</th><th>رجوع السكن</th><th>إجمالي اليوم</th><th>داخل المشاريع</th><th>تنقل / ضائع</th><th>الإنتاجية</th></tr></thead><tbody><tr><td colspan="8">جاري التحميل...</td></tr></tbody></table>';
      box.appendChild(div);
    }
  }
  function timeFromIsoV65(v){ if(!v) return '-'; try{return new Date(v).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});}catch(e){return '-'} }
  async function renderSavedJourneyRowsV65(){
    const div=document.getElementById('journeySavedRowsV65'); if(!div) return;
    const date=document.getElementById('journeyDateV61')?.value||todayV65();
    const sup=journeySupIdV65();
    const rows=await fetchJourneyRowsV65(date,sup);
    const tbody=div.querySelector('tbody'); if(!tbody) return;
    if(window.__journeyCloudErrorV65 && !rows.length){
      tbody.innerHTML='<tr><td colspan="8">لم يتم تحميل رحلات السحابة. شغّل ملف schema_update_v65_daily_journeys.sql أولًا.</td></tr>';
      return;
    }
    tbody.innerHTML=rows.map(r=>'<tr><td>'+escV65(r.journey_date)+'</td><td>'+escV65(supervisorLabelV65(r.supervisor_id))+'</td><td>'+timeFromIsoV65(r.housing_out_time)+'</td><td>'+timeFromIsoV65(r.housing_return_time)+'</td><td>'+fmtMinsV65(r.total_minutes)+'</td><td>'+fmtMinsV65(r.project_minutes)+'</td><td>'+fmtMinsV65(r.travel_minutes)+'</td><td>'+Number(r.productivity_percent||0).toFixed(1)+'%</td></tr>').join('') || '<tr><td colspan="8">لا توجد رحلات محفوظة لهذا اليوم</td></tr>';
  }
  function fillSavedFieldsFromCloudV65(row){
    if(!row) return;
    const s=document.getElementById('journeyStartV61'), e=document.getElementById('journeyEndV61');
    if(s && row.housing_out_time && !s.value) s.value=new Date(row.housing_out_time).toTimeString().slice(0,5);
    if(e && row.housing_return_time && !e.value) e.value=new Date(row.housing_return_time).toTimeString().slice(0,5);
  }
  async function loadCurrentJourneyCloudV65(){
    const date=document.getElementById('journeyDateV61')?.value||todayV65();
    const sup=journeySupIdV65();
    if(!sup) return;
    const rows=await fetchJourneyRowsV65(date,sup);
    fillSavedFieldsFromCloudV65(rows[0]);
    window.renderJourneyV61(false);
  }
  window.renderJourneyV61=function(loadCloud=true){
    lockSupervisorSelectV65();
    ensureJourneyExtrasV65();
    const date=document.getElementById('journeyDateV61')?.value||todayV65();
    const sup=journeySupIdV65();
    const start=document.getElementById('journeyStartV61')?.value||'';
    const end=document.getElementById('journeyEndV61')?.value||'';
    const c=calcJourneyV65(date,sup,start,end);
    const res=document.getElementById('journeyResultV61');
    if(res){
      const warn=c.conflict?'<div class="kpi" style="grid-column:1/-1"><small>تنبيه</small><b style="font-size:18px;color:#9a6b00">يوجد تداخل أو تعارض في سجلات المشاريع، وتم ضبط الإنتاجية حتى لا تتجاوز 100%</b></div>':'';
      res.innerHTML='<div class="kpi"><small>إجمالي اليوم</small><b>'+fmtMinsV65(c.total)+'</b></div><div class="kpi"><small>داخل المشاريع</small><b>'+fmtMinsV65(c.work)+'</b></div><div class="kpi"><small>تنقل / ضائع</small><b>'+fmtMinsV65(c.travel)+'</b></div><div class="kpi"><small>نسبة الإنتاجية</small><b>'+c.productivity+'%</b></div>'+warn;
    }
    if(loadCloud){ setTimeout(loadCurrentJourneyCloudV65,10); setTimeout(renderSavedJourneyRowsV65,60); }
  };
  window.saveJourneyV61=async function(){
    lockSupervisorSelectV65();
    const date=document.getElementById('journeyDateV61')?.value||todayV65();
    const sup=journeySupIdV65();
    const start=document.getElementById('journeyStartV61')?.value||'';
    const end=document.getElementById('journeyEndV61')?.value||'';
    if(!sup){ if(typeof msg==='function') msg('اختر مشرف محدد لحفظ رحلة التشغيل','err'); return; }
    if(!start && !end){ if(typeof msg==='function') msg('أدخل وقت الخروج من السكن أو وقت الرجوع للسكن','err'); return; }
    let previous={}; try{ previous=JSON.parse(localStorage.getItem('tasneef_journey_'+date+'_'+sup)||'{}'); }catch(e){}
    const c=calcJourneyV65(date,sup,start,end);
    localStorage.setItem('tasneef_journey_'+date+'_'+sup,JSON.stringify({start,end,updated_at:new Date().toISOString()}));
    try{
      await saveJourneyCloudV65(date,sup,start,end,c);
      if(typeof msg==='function') msg('تم حفظ رحلة التشغيل في السحابة');
    }catch(e){
      if(typeof msg==='function') msg('تم الحفظ محليًا فقط. شغّل SQL جدول رحلات التشغيل: '+(e.message||e),'err');
    }
    window.renderJourneyV61(false);
    renderSavedJourneyRowsV65();
    if(start && start!==previous.start) openWhatsappV65(journeyMsgV65('start',sup,date,start));
    else if(end && end!==previous.end) openWhatsappV65(journeyMsgV65('end',sup,date,end));
  };
  const oldRenderAllV65=window.renderAll;
  window.renderAll=function(){ if(typeof oldRenderAllV65==='function') oldRenderAllV65.apply(this,arguments); setTimeout(()=>{lockSupervisorSelectV65(); ensureJourneyExtrasV65(); window.renderJourneyV61(false); renderSavedJourneyRowsV65();},350); };
  window.addEventListener('load',()=>setTimeout(()=>{lockSupervisorSelectV65(); ensureJourneyExtrasV65(); window.renderJourneyV61();},1200));
})();

/* ===== V66: Force cloud save for daily journeys (insert/update, visible errors, no local-only silence) ===== */
(function(){
  function uV66(){ try{return typeof session==='function'?session():JSON.parse(localStorage.getItem('tasneef_user')||'null')}catch(e){return null} }
  function todayV66(){ return typeof today==='function'?today():new Date().toISOString().slice(0,10); }
  function escV66(v){ return String(v ?? '').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function fmtMinsV66(m){ m=Math.max(0,Math.round(Number(m)||0)); const h=Math.floor(m/60), mm=m%60; return h+':'+String(mm).padStart(2,'0'); }
  function localDateV66(date,time){ if(!date||!time) return null; return new Date(date+'T'+time+':00'); }
  function isoV66(date,time,plusDay){ const d=localDateV66(date,time); if(!d) return null; if(plusDay) d.setDate(d.getDate()+1); return d.toISOString(); }
  function rangeV66(date,start,end){
    const s=localDateV66(date,start), e=localDateV66(date,end);
    if(!s||!e) return {start:s,end:e,total:0,overnight:false};
    let overnight=false;
    if(e<s){ e.setDate(e.getDate()+1); overnight=true; }
    return {start:s,end:e,total:Math.max(0,Math.round((e-s)/60000)),overnight};
  }
  function logDayV66(l){ return l.log_date || String(l.check_in||'').slice(0,10); }
  function overlapV66(log,start,end){
    if(!log.check_in||!log.check_out||!start||!end) return 0;
    let a=new Date(log.check_in), b=new Date(log.check_out);
    if(b<a) b=new Date(b.getTime()+86400000);
    const os=Math.max(a.getTime(), start.getTime());
    const oe=Math.min(b.getTime(), end.getTime());
    return Math.max(0, Math.round((oe-os)/60000));
  }
  function getSupV66(){
    const u=uV66();
    if(u && u.role==='supervisor') return String(u.id);
    const sel=document.getElementById('journeySupervisorV61');
    return sel ? String(sel.value||'') : '';
  }
  function calcV66(date,sup,start,end){
    const r=rangeV66(date,start,end);
    let logs=(window.data?.logs||[]).filter(l=>logDayV66(l)===date && l.check_in && l.check_out);
    if(sup) logs=logs.filter(l=>String(l.supervisor_id)===String(sup));
    const raw=logs.reduce((a,l)=>a+overlapV66(l,r.start,r.end),0);
    const work=Math.min(raw, r.total||0);
    const travel=Math.max(0,(r.total||0)-work);
    const productivity=r.total?Math.min(100,Math.round((work/r.total)*1000)/10):0;
    return {total:r.total||0, work, rawWork:raw, travel, productivity, overnight:r.overnight, conflict: raw>(r.total||0)};
  }
  function supervisorNameV66(id){
    const u=uV66();
    if(u && String(u.id)===String(id)) return u.full_name||u.username||'المشرف';
    try{ if(typeof supervisorName==='function') return supervisorName(id)||'المشرف'; }catch(e){}
    const all=[...(window.data?.supervisors||[]), ...(window.data?.users||[]), ...(window.data?.app_users||[])];
    const s=all.find(x=>String(x.id)===String(id));
    return s ? (s.full_name||s.name||s.username||'المشرف') : 'المشرف';
  }
  function timeTextV66(v){ if(!v) return '-'; try{return new Date(v).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});}catch(e){return '-'} }
  function notifyV66(text,type){ if(typeof msg==='function') msg(text,type); else alert(text); }
  function lockSupV66(){
    const u=uV66(), sel=document.getElementById('journeySupervisorV61');
    if(!sel) return;
    if(u && u.role==='supervisor'){
      sel.innerHTML='<option value="'+escV66(u.id)+'">'+escV66(u.full_name||u.username||'المشرف')+'</option>';
      sel.value=String(u.id); sel.disabled=true;
    } else {
      sel.disabled=false;
    }
  }
  async function fetchRowsV66(date,sup){
    let q=sb.from('daily_journeys').select('*').eq('journey_date',date).order('supervisor_id',{ascending:true});
    if(sup) q=q.eq('supervisor_id',Number(sup));
    const {data:rows,error}=await q;
    if(error) throw error;
    return rows||[];
  }
  async function saveCloudV66(date,sup,start,end,calc){
    if(!window.sb && typeof sb==='undefined') throw new Error('اتصال Supabase غير موجود في الصفحة');
    const row={
      supervisor_id:Number(sup),
      journey_date:date,
      housing_out_time:start?isoV66(date,start,false):null,
      housing_return_time:end?isoV66(date,end,calc.overnight):null,
      total_minutes:calc.total,
      project_minutes:calc.work,
      travel_minutes:calc.travel,
      productivity_percent:calc.productivity,
      updated_at:new Date().toISOString()
    };
    // First try manual update/insert. This avoids upsert/onConflict issues.
    const found=await sb.from('daily_journeys').select('id').eq('supervisor_id',Number(sup)).eq('journey_date',date).limit(1);
    if(found.error) throw found.error;
    if(found.data && found.data[0]){
      const {error}=await sb.from('daily_journeys').update(row).eq('id',found.data[0].id);
      if(error) throw error;
      return 'updated';
    } else {
      row.created_at=new Date().toISOString();
      const {error}=await sb.from('daily_journeys').insert(row);
      if(error) throw error;
      return 'inserted';
    }
  }
  function ensureBoxV66(){
    const box=document.getElementById('journeyBoxV61'); if(!box) return;
    if(!document.getElementById('journeyCloudStatusV66')){
      const d=document.createElement('div');
      d.id='journeyCloudStatusV66';
      d.style.cssText='margin:10px 0;padding:10px;border-radius:12px;background:#f3faf7;border:1px solid #cfe4dc;color:#064b3b;font-weight:700;display:none';
      box.insertBefore(d, document.getElementById('journeySavedRowsV65') || null);
    }
    if(!document.getElementById('journeySavedRowsV65')){
      const div=document.createElement('div');
      div.id='journeySavedRowsV65';
      div.className='table-wrap';
      div.style.marginTop='16px';
      div.innerHTML='<table><thead><tr><th>التاريخ</th><th>المشرف</th><th>خروج السكن</th><th>رجوع السكن</th><th>إجمالي اليوم</th><th>داخل المشاريع</th><th>تنقل / ضائع</th><th>الإنتاجية</th></tr></thead><tbody><tr><td colspan="8">جاري التحميل...</td></tr></tbody></table>';
      box.appendChild(div);
    }
  }
  function statusV66(text,isError){
    const d=document.getElementById('journeyCloudStatusV66'); if(!d) return;
    d.style.display='block';
    d.style.background=isError?'#fff1f2':'#f3faf7';
    d.style.borderColor=isError?'#fecdd3':'#cfe4dc';
    d.style.color=isError?'#991b1b':'#064b3b';
    d.textContent=text;
  }
  async function renderRowsV66(){
    ensureBoxV66();
    const div=document.getElementById('journeySavedRowsV65'); if(!div) return;
    const date=document.getElementById('journeyDateV61')?.value||todayV66();
    const sup=getSupV66();
    const tbody=div.querySelector('tbody'); if(!tbody) return;
    try{
      const rows=await fetchRowsV66(date,sup);
      tbody.innerHTML=rows.map(r=>'<tr><td>'+escV66(r.journey_date)+'</td><td>'+escV66(supervisorNameV66(r.supervisor_id))+'</td><td>'+timeTextV66(r.housing_out_time)+'</td><td>'+timeTextV66(r.housing_return_time)+'</td><td>'+fmtMinsV66(r.total_minutes)+'</td><td>'+fmtMinsV66(r.project_minutes)+'</td><td>'+fmtMinsV66(r.travel_minutes)+'</td><td>'+Number(r.productivity_percent||0).toFixed(1)+'%</td></tr>').join('') || '<tr><td colspan="8">لا توجد رحلات محفوظة لهذا اليوم</td></tr>';
    }catch(e){
      tbody.innerHTML='<tr><td colspan="8">خطأ تحميل الرحلات: '+escV66(e.message||e)+'</td></tr>';
      statusV66('خطأ في قراءة جدول daily_journeys: '+(e.message||e), true);
    }
  }
  const prevRenderV66=window.renderJourneyV61;
  window.renderJourneyV61=function(loadCloud){
    lockSupV66(); ensureBoxV66();
    const date=document.getElementById('journeyDateV61')?.value||todayV66();
    const sup=getSupV66();
    const start=document.getElementById('journeyStartV61')?.value||'';
    const end=document.getElementById('journeyEndV61')?.value||'';
    const c=calcV66(date,sup,start,end);
    const res=document.getElementById('journeyResultV61');
    if(res){
      const warn=c.conflict?'<div class="kpi" style="grid-column:1/-1"><small>تنبيه</small><b style="font-size:18px;color:#9a6b00">تم احتساب وقت المشاريع داخل فترة رحلة السكن فقط، ومنع تجاوز الإنتاجية 100%</b></div>':'';
      res.innerHTML='<div class="kpi"><small>إجمالي اليوم</small><b>'+fmtMinsV66(c.total)+'</b></div><div class="kpi"><small>داخل المشاريع</small><b>'+fmtMinsV66(c.work)+'</b></div><div class="kpi"><small>تنقل / ضائع</small><b>'+fmtMinsV66(c.travel)+'</b></div><div class="kpi"><small>نسبة الإنتاجية</small><b>'+c.productivity+'%</b></div>'+warn;
    }
    setTimeout(renderRowsV66,80);
  };
  window.saveJourneyV61=async function(){
    lockSupV66(); ensureBoxV66();
    const date=document.getElementById('journeyDateV61')?.value||todayV66();
    const sup=getSupV66();
    const start=document.getElementById('journeyStartV61')?.value||'';
    const end=document.getElementById('journeyEndV61')?.value||'';
    if(!sup){ notifyV66('اختر مشرف محدد لحفظ رحلة التشغيل','err'); return; }
    if(!start && !end){ notifyV66('أدخل وقت الخروج من السكن أو وقت الرجوع للسكن','err'); return; }
    const c=calcV66(date,sup,start,end);
    try{
      const action=await saveCloudV66(date,sup,start,end,c);
      localStorage.setItem('tasneef_journey_'+date+'_'+sup, JSON.stringify({start,end,updated_at:new Date().toISOString(),cloud:true}));
      statusV66('تم حفظ رحلة التشغيل في السحابة بنجاح ('+(action==='inserted'?'إضافة':'تحديث')+').');
      notifyV66('تم حفظ رحلة التشغيل في السحابة');
    }catch(e){
      statusV66('فشل حفظ الرحلة في السحابة: '+(e.message||e), true);
      notifyV66('فشل حفظ الرحلة في السحابة: '+(e.message||e),'err');
      return;
    }
    window.renderJourneyV61(false);
    renderRowsV66();
  };
  const oldRenderAllV66=window.renderAll;
  window.renderAll=function(){ if(typeof oldRenderAllV66==='function') oldRenderAllV66.apply(this,arguments); setTimeout(()=>{lockSupV66(); ensureBoxV66(); window.renderJourneyV61(false); renderRowsV66();},450); };
  window.addEventListener('load',()=>setTimeout(()=>{lockSupV66(); ensureBoxV66(); window.renderJourneyV61(false); renderRowsV66();},1500));
})();

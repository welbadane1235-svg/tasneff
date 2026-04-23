(function(){
  const seed = {
    supervisors:[
      {name:'فهد', username:'fahd', password:'1234'},
      {name:'محمد إبراهيم', username:'m_ibrahim', password:'1234'},
      {name:'محمود', username:'mahmoud', password:'1234'},
      {name:'مازن', username:'mazen', password:'1234'},
      {name:'مازن الخطيب', username:'mazen_khatib', password:'1234'},
      {name:'محمد عبده', username:'m_abdo', password:'1234'}
    ],
    projectsBySupervisor:{
      'فهد':['فارهين 11','آفاق العربية','مغنى 29','هاجر 32','فرساي 7','تعمير 17','رايات نجد 5','رؤيا 1','عالم الابتكار 47','الشعلان 50','الشعلان 51'],
      'محمد إبراهيم':['كاف A','كاف B','كاف C','واجهة قرطبة','الماجدية 107','صفاء 50','مغنى 14','الماجدية 88','العجلان 19'],
      'محمود':['مكين 37'],
      'مازن':['جادة 39','ألين 32','أثل 12','فرساي 4','فرساي 10','فرساي 11','اتحاد العاصمة'],
      'مازن الخطيب':['وجود الياسمين'],
      'محمد عبده':['صفاء 28','صفاء 65','جمال الأندلس','برج جوديا']
    },
    workersByProject:{
      'فارهين 11':['ميزان','سوجان','عليم','مهيد'],
      'آفاق العربية':['ميزان','سوجان','عليم','مهيد'],
      'مغنى 29':['ميزان','سوجان','عليم','مهيد'],
      'هاجر 32':['ميزان','سوجان','عليم','مهيد'],
      'فرساي 7':['ميزان','سوجان','عليم','مهيد'],
      'تعمير 17':['ميزان','سوجان','عليم','مهيد'],
      'رايات نجد 5':['ميزان','سوجان','عليم','مهيد'],
      'رؤيا 1':['ميزان','سوجان','عليم','مهيد'],
      'عالم الابتكار 47':['ميزان','سوجان','عليم','مهيد'],
      'الشعلان 50':['ياسر','راجو'],
      'الشعلان 51':['ياسر','راجو'],
      'كاف A':['عجائب','اوسيس','كوثر','راهي'],
      'كاف B':['عجائب','اوسيس','كوثر','راهي'],
      'كاف C':['عجائب','اوسيس','كوثر','راهي'],
      'واجهة قرطبة':['عجائب','اوسيس','كوثر','راهي'],
      'الماجدية 107':['عجائب','اوسيس','كوثر','راهي'],
      'صفاء 50':['عجائب','اوسيس','كوثر','راهي'],
      'مغنى 14':['عجائب','اوسيس','كوثر','راهي'],
      'الماجدية 88':['رحمن','رقيب'],
      'العجلان 19':['رؤوف','اوميت'],
      'مكين 37':['جهيد','ركيب','اكتار','جوناب علي'],
      'جادة 39':['عاريف','ديلوار','علي','رشيد','جاشيم','روبيول'],
      'ألين 32':['عاريف','ديلوار','علي','رشيد','جاشيم','روبيول'],
      'أثل 12':['عاريف','ديلوار','علي','رشيد','جاشيم','روبيول'],
      'فرساي 4':['عاريف','ديلوار','علي','رشيد','جاشيم','روبيول'],
      'فرساي 10':['عاريف','ديلوار','علي','رشيد','جاشيم','روبيول'],
      'فرساي 11':['عاريف','ديلوار','علي','رشيد','جاشيم','روبيول'],
      'اتحاد العاصمة':['عاريف','ديلوار','علي','رشيد','جاشيم','روبيول'],
      'وجود الياسمين':['إبراهيم','شميم','أنور','تيفور','ناظمون','جابيت','ديكسان','الونجير','هلال','اشرف','روبل','فضل'],
      'صفاء 28':['راسيل','مهيب','عريف','اكرامول'],
      'صفاء 65':['السيد علي','ليتون','همينتو'],
      'جمال الأندلس':['السيد علي','راسيل','مهيب'],
      'برج جوديا':['علم','فلومية','بتشا','مساد']
    },
    aliases:{
      projects:{'افاق العربية':'آفاق العربية','هاجر32':'هاجر 32','تعمير17':'تعمير 17','عالم الابتكار 46':'عالم الابتكار 47','صفا 50':'صفاء 50','صفا 28':'صفاء 28','صفا 65':'صفاء 65','جمال الاندلس':'جمال الأندلس','الين 32':'ألين 32','اثل 12':'أثل 12','البرج':'برج جوديا'},
      workers:{'اوسيس':'أوسيس','اوميت':'أوميت','اكتار':'أكتار','اشرف':'أشرف','انور':'أنور','سوجان':'سوجان','مهيد':'مهيد','سيد علي':'السيد علي','راسل':'راسيل','عارف':'عاريف'},
      supervisors:{'محمد ابراهيم':'محمد إبراهيم'}
    }
  };
  function normalizeBase(v){ return String(v||'').trim().replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/\s+/g,' '); }
  function canonical(kind, value){
    const raw = String(value||'').trim();
    const map = (seed.aliases && seed.aliases[kind]) || {};
    if (map[raw]) return map[raw];
    const n = normalizeBase(raw);
    for (const [k,v] of Object.entries(map)) if (normalizeBase(k)===n) return v;
    if (kind==='projects') {
      for (const p of Object.values(seed.projectsBySupervisor).flat()) if (normalizeBase(p)===n) return p;
    }
    if (kind==='workers') {
      for (const w of Object.values(seed.workersByProject).flat()) if (normalizeBase(w)===n) return w;
    }
    if (kind==='supervisors') {
      for (const s of seed.supervisors.map(x=>x.name)) if (normalizeBase(s)===n) return s;
    }
    return raw;
  }
  function allProjects(){ return [...new Set(Object.values(seed.projectsBySupervisor).flat())]; }
  function allWorkers(){ return [...new Set(Object.values(seed.workersByProject).flat().map(v=>canonical('workers',v)))]; }
  function supervisorForProject(project){
    const p = canonical('projects', project);
    for (const [sup, projects] of Object.entries(seed.projectsBySupervisor)) if (projects.includes(p)) return sup;
    return '';
  }
  function workersForProject(project){
    const p = canonical('projects', project);
    return (seed.workersByProject[p] || []).map(v=>canonical('workers',v));
  }
  function projectsForSupervisor(supervisor){
    const s = canonical('supervisors', supervisor);
    return (seed.projectsBySupervisor[s] || []).slice();
  }
  function usersList(){
    return seed.supervisors.map((s,i)=>({
      id:'seed-sup-'+(i+1), username:s.username, password:s.password, role:'supervisor', full_name:s.name, supervisor_name:s.name, is_active:true, permissions:{}
    }));
  }
  window.SharedBridge = {seed, normalizeBase, canonical, allProjects, allWorkers, supervisorForProject, workersForProject, projectsForSupervisor, usersList};
})();

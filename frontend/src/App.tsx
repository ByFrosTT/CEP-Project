import { FormEvent, useEffect, useMemo, useState } from "react";

type IconName = "dashboard"|"students"|"analytics"|"interventions"|"reports"|"search"|"bell"|"chevron"|"arrow"|"close"|"book"|"calendar"|"users"|"clipboard"|"code"|"brain"|"terminal"|"sparkles"|"check"|"clock"|"trending"|"warning"|"dots"|"logout";
type User = {username:string;role:"student"|"professor";display_name:string;email?:string;student_id?:string|null};
type ShapItem = {feature:string;name:string;value:number;impact:number;direction:string};
type Intervention = {id:number;student_id:string;student_name?:string;initials?:string;professor_name:string;note:string;status:string;follow_up_date?:string;created_at:string;completed_at?:string};
type Student = {id:string;name:string;initials:string;semester:number;course:string;campus:string;attendance:number;internal_marks:number;practical_completion:number;backlogs:number;lab_hours_weekly:number;assignments_done:number;assignments_total:number;risk:string;risk_score:number;confidence:number;probabilities:Record<string,number>;shap_values?:ShapItem[];interventions?:Intervention[];open_interventions:number;source?:string};
type Dashboard = {total_students:number;risk_counts:Record<string,number>;average_attendance:number;improving_students:number;open_interventions:number;model_accuracy:number;feature_importance:{name:string;value:number}[];updated_at:string};

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";
const colors = ["violet","teal","blue","amber","coral"];

function Icon({name,size=20}:{name:IconName;size?:number}) {
  const paths:Record<IconName,React.ReactNode>={
    dashboard:<><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    students:<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    analytics:<><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></>,interventions:<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
    reports:<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></>,
    search:<><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,bell:<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    chevron:<path d="m9 18 6-6-6-6"/>,arrow:<path d="m5 12 14 0m-6-6 6 6-6 6"/>,close:<path d="M18 6 6 18M6 6l12 12"/>,
    book:<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></>,
    calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></>,users:<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    clipboard:<><rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V2h6v2M9 12l2 2 4-4M9 18h6"/></>,code:<><path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14"/></>,
    brain:<><path d="M9.5 4.5A3 3 0 0 0 4 6v1a3 3 0 0 0-1 5.5A3 3 0 0 0 6 17v1a3 3 0 0 0 5.5 1.5V5A3 3 0 0 0 9.5 4.5ZM14.5 4.5A3 3 0 0 1 20 6v1a3 3 0 0 1 1 5.5 3 3 0 0 1-3 4.5v1a3 3 0 0 1-5.5 1.5V5a3 3 0 0 1 2-0.5Z"/></>,
    terminal:<><path d="m4 17 6-6-6-6M12 19h8"/></>,sparkles:<><path d="m12 3-1.4 3.6L7 8l3.6 1.4L12 13l1.4-3.6L17 8l-3.6-1.4L12 3ZM5 15l-.8 2.2L2 18l2.2.8L5 21l.8-2.2L8 18l-2.2-.8L5 15ZM19 13l-.6 1.4L17 15l1.4.6L19 17l.6-1.4L21 15l-1.4-.6L19 13Z"/></>,
    check:<path d="m5 12 4 4L19 6"/>,clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,trending:<><path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/></>,
    warning:<><path d="M10.3 3.5 2.4 18a2 2 0 0 0 1.8 3h15.6a2 2 0 0 0 1.8-3L13.7 3.5a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></>,
    dots:<><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></>,
    logout:<><path d="M10 17l5-5-5-5M15 12H3"/><path d="M13 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

async function api<T>(path:string, token?:string, options:RequestInit={}):Promise<T>{
  const headers:Record<string,string>={"Content-Type":"application/json",...(options.headers as Record<string,string>||{})};
  if(token) headers.Authorization=`Bearer ${token}`;
  const res=await fetch(`${API}${path}`,{...options,headers});
  const body=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(body.error||`Request failed (${res.status})`);
  return body as T;
}
function Avatar({initials,color="violet",small=false}:{initials:string;color?:string;small?:boolean}){return <span className={`avatar avatar-${color} ${small?"avatar-small":""}`}>{initials}</span>}
function RiskBadge({risk}:{risk:string}){return <span className={`risk-badge risk-${risk.toLowerCase()}`}><span/>{risk}</span>}
function SectionTitle({title,subtitle,action}:{title:string;subtitle?:string;action?:React.ReactNode}){return <div className="section-heading"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>}
function Busy({text="Loading Edu-Insight..."}:{text?:string}){return <div className="busy-screen"><div className="brand-mark"><Icon name="sparkles"/></div><strong>{text}</strong></div>}
function Toast({text,onClose}:{text:string;onClose:()=>void}){useEffect(()=>{const t=setTimeout(onClose,3200);return()=>clearTimeout(t)},[onClose]);return <div className="toast"><Icon name="check" size={16}/>{text}</div>}

function Login({onLogin}:{onLogin:(token:string,user:User)=>void}){
  const [registering,setRegistering]=useState(false);
  const [username,setUsername]=useState("professor"),[password,setPassword]=useState("prof123"),[error,setError]=useState(""),[loading,setLoading]=useState(false);
  async function submit(e:FormEvent){e.preventDefault();setLoading(true);setError("");try{const data=await api<{token:string;user:User}>("/auth/login",undefined,{method:"POST",body:JSON.stringify({username,password})});localStorage.setItem("Edu-Insight_token",data.token);onLogin(data.token,data.user)}catch(err){setError((err as Error).message)}finally{setLoading(false)}}
  if(registering)return <div className="registration-page"><StudentForm mode="register" close={()=>setRegistering(false)} onSaved={()=>{}} onLogin={onLogin}/></div>;
  return <div className="login-page"><div className="login-art"><div className="brand login-brand"><div className="brand-mark"><Icon name="sparkles" size={24}/></div><div><strong>Edu-Insight</strong><b>XAI</b></div></div><div className="login-copy"><span>EXPLAINABLE ACADEMIC INTELLIGENCE</span><h1>Turn academic risk into timely support.</h1><p>Random Forest predictions, SHAP explanations, faculty interventions and student guidance in one role-aware experience.</p><div className="login-features"><div><Icon name="brain"/><span><b>Explainable AI</b><small>See what drives every prediction</small></span></div><div><Icon name="students"/><span><b>Two secure roles</b><small>Professor and student experiences</small></span></div><div><Icon name="trending"/><span><b>What-if planning</b><small>Test how improvements change risk</small></span></div></div></div></div><div className="login-panel"><form onSubmit={submit} className="login-card"><span className="eyebrow">VSIT ACADEMIC RISK SYSTEM</span><h2>Sign in to Edu-Insight</h2><p>Choose a demo account below or enter its credentials.</p><div className="demo-accounts"><button type="button" onClick={()=>{setUsername("professor");setPassword("prof123")}}><Icon name="dashboard"/><span><b>Professor</b><small>professor / prof123</small></span></button><button type="button" onClick={()=>{setUsername("student");setPassword("student123")}}><Icon name="students"/><span><b>Student</b><small>student / student123</small></span></button></div><label>Username<input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username"/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label>{error&&<div className="form-error">{error}</div>}<button className="login-submit" disabled={loading}>{loading?"Signing in...":"Sign in"}<Icon name="arrow" size={17}/></button><button type="button" className="register-link" onClick={()=>setRegistering(true)}>New student? Create your account <Icon name="arrow" size={17}/></button></form></div></div>
}

function Sidebar({active,setActive,user,logout}:{active:string;setActive:(s:string)=>void;user:User;logout:()=>void}){
 const nav:[[string,IconName],...[string,IconName][]]=[["Dashboard","dashboard"],["Students","students"],["Risk Analytics","analytics"],["Interventions","interventions"],["Reports","reports"],["Check Risk","brain"]];
 return <aside className="sidebar"><div className="brand"><div className="brand-mark"><Icon name="sparkles" size={21}/></div><div><strong>Edu-Insight</strong><b>XAI</b></div></div><p className="nav-label">WORKSPACE</p><nav>{nav.map(([label,icon])=><button key={label} className={active===label?"active":""} onClick={()=>setActive(label)}><Icon name={icon}/><span>{label}</span></button>)}</nav><div className="sidebar-promo"><div className="promo-icon"><Icon name="brain"/></div><strong>Explainable by design</strong><p>Predictions are paired with SHAP feature contributions and what-if simulation.</p></div><div className="campus"><div className="campus-logo">V</div><div><strong>{user.display_name}</strong><span>Faculty Portal</span></div><button className="mini-logout" onClick={logout} title="Sign out"><Icon name="logout" size={16}/></button></div></aside>
}
function Topbar({students,onStudent,user,onProfile}:{students:Student[];onStudent:(s:Student)=>void;user:User;onProfile:()=>void}){
 const [query,setQuery]=useState(""); const matches=query?students.filter(s=>`${s.name} ${s.id}`.toLowerCase().includes(query.toLowerCase())).slice(0,6):[];
 return <header className="topbar"><div className="search-wrap"><Icon name="search"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search loaded students by name or ID..."/>{matches.length>0&&<div className="autocomplete">{matches.map((s,i)=><button key={s.id} onClick={()=>{onStudent(s);setQuery("")}}><Avatar initials={s.initials} color={colors[i%colors.length]} small/><span><strong>{s.name}</strong><small>{s.id}</small></span><RiskBadge risk={s.risk}/></button>)}</div>}</div><div className="top-actions"><button className="profile-trigger" onClick={onProfile} aria-label="Edit my profile"><Avatar initials={user.display_name.split(" ").map(x=>x[0]).slice(0,2).join("")} color="teal" small/><div className="profile-name"><strong>{user.display_name}</strong><span>Edit profile</span></div><Icon name="chevron" size={16}/></button></div></header>
}
function KpiCard({label,value,meta,icon,tone,progress}:{label:string;value:string;meta:string;icon:IconName;tone:string;progress?:number}){return <div className="card kpi-card"><div className={`kpi-icon ${tone}`}><Icon name={icon}/></div><div className="kpi-copy"><span>{label}</span><strong>{value}</strong><small className={tone==="red"?"negative":""}>{meta}</small></div>{progress!==undefined&&<div className="mini-ring" style={{"--progress":`${progress*3.6}deg`} as React.CSSProperties}><span>{progress}%</span></div>}</div>}
function RiskOverview({d}:{d:Dashboard}){const total=d.total_students;return <div className="card chart-card"><SectionTitle title="Risk Overview" subtitle="Predictions for current saved student records" action={<span className="live-pill"><i/>LIVE</span>}/><div className="donut-layout"><div className="donut dynamic-donut" style={{"--low":`${(d.risk_counts.Low/total)*100}%`,"--medium":`${((d.risk_counts.Low+d.risk_counts.Medium)/total)*100}%`} as React.CSSProperties}><div><strong>{total}</strong><span>Students</span></div></div><div className="legend">{[["Low Risk",d.risk_counts.Low,"green"],["Medium Risk",d.risk_counts.Medium,"amber"],["High Risk",d.risk_counts.High,"red"]].map(([l,n,c])=><div key={String(l)}><span className={`legend-dot ${c}`}/><p><b>{l}</b><small>{Math.round(Number(n)/total*100)}% of students</small></p><strong>{n}</strong></div>)}</div></div></div>}
function RiskFactors({d}:{d:Dashboard}){const max=Math.max(...d.feature_importance.map(f=>f.value),1);return <div className="card chart-card"><SectionTitle title="Top Risk Factors" subtitle="Random Forest global feature importance" action={<span className="model-chip">Accuracy {d.model_accuracy}%</span>}/><div className="factor-chart">{d.feature_importance.map((f,i)=><div className="factor-row" key={f.name}><div><strong>{f.name}</strong><span>{i===0?"Primary driver":i<3?"High impact":"Supporting"}</span></div><div className="factor-track"><i className={`bar-${["red","amber","violet","indigo","teal"][i]}`} style={{width:`${f.value/max*100}%`}}/></div><b>{f.value}%</b></div>)}</div><div className="xai-note"><Icon name="sparkles" size={16}/><span><strong>XAI insight:</strong> These are global model importances; each student profile uses SHAP for individual explanations.</span></div></div>}

function StudentDirectory({
  students, onStudent, onExport, onEdit
}: {
  students: Student[];
  onStudent: (s: Student) => void;
  onExport: () => void;
  onEdit: (s: Student) => void;
}) {
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("All risks");
  const [semester, setSemester] = useState("All semesters");
  const [backlogs, setBacklogs] = useState("All backlogs");

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();

    return students.filter(s =>
      (!search || `${s.name} ${s.id}`.toLowerCase().includes(search)) &&
      (risk === "All risks" || s.risk === risk) &&
      (semester === "All semesters" || s.semester === Number(semester)) &&
      (backlogs === "All backlogs" ||
        (backlogs === "With backlogs" ? s.backlogs > 0 : s.backlogs === 0))
    );
  }, [students, query, risk, semester, backlogs]);

  return (
    <div className="card directory">
      <SectionTitle
        title="Student Directory"
        subtitle="Search current students by full name or student ID"
        action={
          <button className="secondary-button" onClick={onExport}>
            Export report
          </button>
        }
      />

      <div className="directory-search">
        <Icon name="search" />
        <input
          type="search"
          aria-label="Search student directory"
          placeholder="Search by full name or student ID..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {query && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => setQuery("")}
          >
            Clear
          </button>
        )}
      </div>

      <div className="filters">
        <select
          aria-label="Filter by risk"
          value={risk}
          onChange={e => setRisk(e.target.value)}
        >
          <option>All risks</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>

        <select
          aria-label="Filter by semester"
          value={semester}
          onChange={e => setSemester(e.target.value)}
        >
          <option>All semesters</option>
          {[1, 2, 3, 4, 5, 6].map(n => (
            <option key={n} value={n}>Semester {n}</option>
          ))}
        </select>

        <select
          aria-label="Filter by backlogs"
          value={backlogs}
          onChange={e => setBacklogs(e.target.value)}
        >
          <option>All backlogs</option>
          <option>With backlogs</option>
          <option>No backlogs</option>
        </select>

        <span aria-live="polite">
          {filtered.length} of {students.length} students
        </span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Semester</th>
              <th>Attendance</th>
              <th>Risk level</th>
              <th>Backlogs</th>
              <th>Score</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((s, i) => (
              <tr key={s.id} onClick={() => onStudent(s)}>
                <td>
                  <div className="student-cell">
                    <Avatar
                      initials={s.initials}
                      color={colors[i % colors.length]}
                    />
                    <p>
                      <strong>{s.name}</strong>
                      <span>
                        {s.id} · {s.source === "sample" ? "Sample" : "Saved student"}
                      </span>
                    </p>
                  </div>
                </td>

                <td>Semester {s.semester}</td>
                <td>
                  <div className={`attendance ${s.attendance < 70 ? "low" : ""}`}>
                    <div><i style={{ width: `${s.attendance}%` }} /></div>
                    <b>{s.attendance}%</b>
                  </div>
                </td>
                <td><RiskBadge risk={s.risk} /></td>
                <td>{s.backlogs}</td>
                <td><b>{s.risk_score}/100</b></td>

                <td>
                  <div className="directory-row-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={e => {
                        e.stopPropagation();
                        onStudent(s);
                      }}
                    >
                      View
                    </button>

                    <button
                      type="button"
                      className="primary-button"
                      onClick={e => {
                        e.stopPropagation();
                        onEdit(s);
                      }}
                    >
                      Edit profile
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          No students match your search and filters.
        </div>
      )}
    </div>
  );
}

function ProfessorStudentEditor({
  student, token, close, onSaved
}: {
  student: Student;
  token: string;
  close: () => void;
  onSaved: () => void;
}) {
  type Profile = {
    name: string;
    email: string;
    semester: number;
    course: string;
    campus: string;
  };

  const [form, setForm] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api<Profile>(
      `/api/students/${encodeURIComponent(student.id)}/profile`,
      token
    )
      .then(data => {
        if (!cancelled) setForm(data);
      })
      .catch(e => {
        if (!cancelled) setError(e.message);
      });

    return () => { cancelled = true; };
  }, [student.id, token]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;

    setSaving(true);
    setError("");

    try {
      await api(
        `/api/students/${encodeURIComponent(student.id)}/profile`,
        token,
        { method: "PUT", body: JSON.stringify(form) }
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!form) {
    return <p role="status">{error || "Loading student profile..."}</p>;
  }

  return (
    <form className="student-entry" onSubmit={save}>
      <p>
        Student ID: <b>{student.id}</b>.
        {" "}The login username remains unchanged.
      </p>

      <label>
        Full name
        <input
          required minLength={2} maxLength={100}
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
        />
      </label>

      <label>
        Email (optional)
        <input
          type="email" maxLength={150}
          value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })}
        />
      </label>

      <div className="entry-grid">
        <label>
          Semester
          <select
            value={form.semester}
            onChange={e => setForm({
              ...form, semester: Number(e.target.value)
            })}
          >
            {[1, 2, 3, 4, 5, 6].map(n => (
              <option key={n} value={n}>Semester {n}</option>
            ))}
          </select>
        </label>

        <label>
          Course
          <input
            required maxLength={120}
            value={form.course}
            onChange={e => setForm({ ...form, course: e.target.value })}
          />
        </label>

        <label>
          Campus
          <input
            required maxLength={120}
            value={form.campus}
            onChange={e => setForm({ ...form, campus: e.target.value })}
          />
        </label>
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}

      <div className="form-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={close}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="primary-button"
          disabled={saving}
        >
          {saving ? "Saving..." : "Save profile"}
        </button>
      </div>
    </form>
  );
}
function ProfilePanel({student,token,close,onChanged}:{student:Student;token:string;close:()=>void;onChanged:()=>void}){
 const [editing,setEditing]=useState(false);
 const [detail,setDetail]=useState<Student|null>(null),[note,setNote]=useState(""),[whatIf,setWhatIf]=useState({attendance:Math.max(student.attendance,75),backlogs:Math.max(0,student.backlogs-1)}),[scenario,setScenario]=useState<{before:any;after:any;score_change:number}|null>(null),[error,setError]=useState("");
 useEffect(()=>{api<Student>(`/api/students/${student.id}`,token).then(setDetail).catch(e=>setError(e.message))},[student.id,token]);
 async function addNote(){try{await api(`/api/students/${student.id}/interventions`,token,{method:"POST",body:JSON.stringify({note})});setNote("");setDetail(await api<Student>(`/api/students/${student.id}`,token));onChanged()}catch(e){setError((e as Error).message)}}
 async function simulate(){try{setScenario(await api<{before:any;after:any;score_change:number}>(`/api/students/${student.id}/what-if`,token,{method:"POST",body:JSON.stringify(whatIf)}))}catch(e){setError((e as Error).message)}}
 const s=detail||student; if(editing)return <Modal title="Edit student details" close={()=>setEditing(false)}><StudentForm mode="edit" token={token} student={s} close={()=>setEditing(false)} onSaved={()=>{setEditing(false);api<Student>(`/api/students/${s.id}`,token).then(setDetail);onChanged()}}/></Modal>; const maxImpact=Math.max(...(s.shap_values||[]).map(x=>Math.abs(x.impact)),.001);
 return <><div className="panel-backdrop" onClick={close}/><aside className="profile-panel"><div className="panel-header"><div><span>STUDENT PROFILE</span><h2>Risk intelligence</h2></div><button className="icon-btn" onClick={close}><Icon name="close"/></button></div>{error&&<div className="panel-error">{error}</div>}<div className="student-profile-head"><Avatar initials={s.initials}/><div><h3>{s.name}</h3><p>{s.id} · B.Sc. IT</p><span>Semester {s.semester}</span></div><RiskBadge risk={s.risk}/></div><div className="risk-score-block"><div className="score-ring dynamic-score" style={{"--score":`${s.risk_score}%`} as React.CSSProperties}><div><strong>{s.risk_score}</strong><span>/100</span></div></div><div><span>PREDICTED RISK SCORE</span><h3>{s.risk} academic risk</h3><p>Confidence: {s.confidence}% · Random Forest</p></div></div><div className="panel-section"><div className="panel-title"><h3>Academic metrics</h3><button onClick={()=>setEditing(true)}>Edit details</button></div><div className="metric-grid"><div><span>Attendance</span><strong>{s.attendance}%</strong></div><div><span>Internal marks</span><strong>{s.internal_marks}%</strong></div><div><span>Practicals</span><strong>{s.practical_completion}%</strong></div><div><span>Backlogs</span><strong className="danger">{s.backlogs}</strong></div></div></div><div className="panel-section shap-section"><div className="panel-title"><h3><Icon name="sparkles" size={17}/> Why this score?</h3><span className="xai-pill">XAI · SHAP</span></div><p>SHAP contributions to the predicted class probability, not risk-score points.</p>{(s.shap_values||[]).slice(0,5).map((x,i)=><div className="shap-row" key={x.feature}><div><span>{x.name} ({x.value})</span><b className={x.impact>0?"shap-red":"shap-green"}>{x.impact>0?"+":""}{x.impact.toFixed(3)}</b></div><div><i className={x.impact>0?"bar-red":"bar-green"} style={{width:`${Math.abs(x.impact)/maxImpact*100}%`}}/></div></div>)}<div className="plain-language"><Icon name="brain"/><p><strong>In simple terms</strong><span>{s.shap_values?.[0]?.name||"Academic factors"} has the strongest model contribution for this prediction.</span></p></div></div><div className="panel-section"><div className="panel-title"><h3>What-if simulator</h3><button onClick={simulate}>Run scenario</button></div><div className="whatif-grid"><label>Attendance<input type="number" min="0" max="100" value={whatIf.attendance} onChange={e=>setWhatIf({...whatIf,attendance:Number(e.target.value)})}/></label><label>Backlogs<input type="number" min="0" max="10" value={whatIf.backlogs} onChange={e=>setWhatIf({...whatIf,backlogs:Number(e.target.value)})}/></label></div>{scenario&&<div className={`scenario-result ${scenario.score_change<=0?"better":"worse"}`}><b>{scenario.after.risk} · {scenario.after.risk_score}/100</b><span>{scenario.score_change<=0?"↓":"↑"} {Math.abs(scenario.score_change)} risk-score points vs current</span></div>}</div><div className="panel-section"><div className="panel-title"><h3>Intervention notes</h3></div>{s.interventions?.map(n=><div className="note-item" key={n.id}><Avatar initials="CM" color="teal" small/><p><strong>{n.professor_name}<span> · {new Date(n.created_at).toLocaleDateString()}</span></strong><em>{n.note}</em></p></div>)}<div className="note-form"><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Add a faculty intervention note..."/><button className="primary-button" onClick={addNote} disabled={note.trim().length<3}>Save note</button></div></div></aside></>
}
function InterventionList({
  items,
  onOpen,
  onComplete
}: {
  items: Intervention[];
  onOpen: (id: string) => void;
  onComplete: (id: number) => void;
}) {
  const pending = items.filter(item => item.status === "open");

  return (
    <div className="card intervention-card">
      <SectionTitle
        title="Priority Interventions"
        subtitle="Stored faculty notes and follow-ups"
        action={
          <span className="count-pill">
            {pending.length} pending
          </span>
        }
      />

      <div className="intervention-list">
        {pending.map((item, index) => (
          <div className="intervention-item" key={item.id}>
            <Avatar
              initials={item.initials || "ST"}
              color={colors[index % colors.length]}
            />

            <div className="intervention-info">
              <div>
                <strong>
                  {item.student_name || item.student_id}
                </strong>
              </div>

              <p>
                <Icon name="clipboard" size={14} />
                {item.note}
              </p>

              <span>
                {item.student_id} · Follow-up{" "}
                {item.follow_up_date || "not set"}
              </span>
            </div>

            <div className="stack-actions">
              <button
                type="button"
                onClick={() => onOpen(item.student_id)}
              >
                Review
              </button>

              <button
                type="button"
                onClick={() => onComplete(item.id)}
              >
                Complete
              </button>
            </div>
          </div>
        ))}
      </div>

      {pending.length === 0 && (
        <div className="empty-state">
          No open interventions.
        </div>
      )}
    </div>
  );
}

function FacultyApp({
  token,
  user,
  logout,
  onProfile
}: {
  token: string;
  user: User;
  logout: () => void;
  onProfile: () => void;
}) {
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [adding, setAdding] = useState(false);
  const [active, setActive] = useState("Dashboard");
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [toast, setToast] = useState("");

  async function load() {
    const [dashboardData, studentData, interventionData] = await Promise.all([
      api<Dashboard>("/api/dashboard", token),
      api<{ students: Student[] }>("/api/students?limit=10000", token),
      api<{ interventions: Intervention[] }>("/api/interventions", token)
    ]);

    setDash(dashboardData);
    setStudents(studentData.students);
    setInterventions(interventionData.interventions);
  }

  useEffect(() => {
    load().catch(e => setToast(e.message));
  }, [token]);

  async function openStudent(student: Student | string) {
    const id = typeof student === "string" ? student : student.id;
    const found = students.find(s => s.id === id);

    if (found) {
      setSelected(found);
      return;
    }

    try {
      const detail = await api<Student>(
        `/api/students/${encodeURIComponent(id)}`,
        token
      );
      setSelected(detail);
    } catch (e) {
      setToast((e as Error).message);
    }
  }

  async function complete(id: number) {
    try {
      await api(`/api/interventions/${id}/complete`, token, {
        method: "POST"
      });
      await load();
      setToast("Intervention marked complete");
    } catch (e) {
      setToast((e as Error).message);
    }
  }

  async function exportCsv() {
    try {
      const response = await fetch(`${API}/api/reports/students.csv`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "Edu-Insight_student_risk_report.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      setToast("CSV report downloaded");
    } catch (e) {
      setToast((e as Error).message);
    }
  }

  if (!dash) {
    return (
      <>
        <Busy text={toast || "Loading professor dashboard..."} />
        {toast && (
          <button
            className="faculty-switch"
            onClick={() => load().catch(e => setToast(e.message))}
          >
            Retry connection
          </button>
        )}
      </>
    );
  }

  return (
  <div className="app-shell">
    <Sidebar
      active={active}
      setActive={setActive}
      user={user}
      logout={logout}
    />

    <main className="main">
      <Topbar
        students={students}
        onStudent={openStudent}
        user={user}
        onProfile={onProfile}
      />

      <div className="content">
        <div className="page-heading">
          <div>
            <p>FACULTY OVERVIEW</p>
            <h1>{active}</h1>
            <span>
              Risk predictions from current saved student records.
              Model trained on synthetic academic data.
            </span>
          </div>

          <div className="updated">
            <div className="form-actions">
              <button
                className="secondary-button"
                onClick={() => load().catch(e => setToast(e.message))}
              >
                Refresh data
              </button>

              <button
                className="primary-button"
                onClick={() => setAdding(true)}
              >
                Add student
              </button>
            </div>

            <span><i /> Model online</span>
            <strong>
              {dash.model_accuracy}% hold-out accuracy
            </strong>
          </div>
        </div>

        {active === "Dashboard" && (
          <>
            <div className="kpi-grid">
              <KpiCard
                label="Total Students"
                value={String(dash.total_students)}
                meta="Current saved student records"
                icon="students"
                tone="indigo"
              />
              <KpiCard
                label="High-Risk Students"
                value={String(dash.risk_counts.High)}
                meta="Current model prediction"
                icon="warning"
                tone="red"
              />
              <KpiCard
                label="Average Attendance"
                value={`${dash.average_attendance}%`}
                meta="Current student average"
                icon="calendar"
                tone="teal"
                progress={Math.round(dash.average_attendance)}
              />
              <KpiCard
                label="Improving / stable"
                value={String(dash.improving_students)}
                meta="Lower score + academic thresholds"
                icon="trending"
                tone="violet"
              />
            </div>

            <div className="dashboard-grid">
              <RiskOverview d={dash} />
              <RiskFactors d={dash} />
              <InterventionList
                items={interventions}
                onOpen={openStudent}
                onComplete={complete}
              />
            </div>

            <StudentDirectory
              students={students}
              onStudent={openStudent}
              onExport={exportCsv}
              onEdit={setEditingStudent}
            />
          </>
        )}

        {active === "Students" && (
          <StudentDirectory
            students={students}
            onStudent={openStudent}
            onExport={exportCsv}
            onEdit={setEditingStudent}
          />
        )}

        {active === "Risk Analytics" && (
          <div className="analytics-page">
            <RiskOverview d={dash} />
            <RiskFactors d={dash} />

            <div className="card explainer-card">
              <SectionTitle
                title="How the model works"
                subtitle="Actual pipeline used by this project"
              />

              <div className="pipeline">
                {[
                  "5 academic inputs",
                  "Random Forest",
                  "Risk probabilities",
                  "SHAP explanation",
                  "What-if simulation"
                ].map((x, i) => (
                  <div key={x}>
                    <span>{i + 1}</span>
                    <b>{x}</b>
                  </div>
                ))}
              </div>

              <p>
                Model accuracy shown here is measured on a stratified
                20% hold-out split of the supplied synthetic dataset.
                It is not a claim of real-world predictive validity.
              </p>
            </div>
          </div>
        )}

        {active === "Interventions" && (
          <InterventionList
            items={interventions}
            onOpen={openStudent}
            onComplete={complete}
          />
        )}

        {active === "Reports" && (
          <div className="card reports-page">
            <Icon name="reports" size={36} />
            <h2>Academic Risk Report</h2>
            <p>
              Export all current student records with model prediction,
              risk score and confidence.
            </p>
            <button className="primary-button" onClick={exportCsv}>
              Download CSV report <Icon name="arrow" size={16} />
            </button>
          </div>
        )}

        {active === "Check Risk" && (
          <RiskChecker token={token} />
        )}
      </div>
    </main>

    {adding && (
      <Modal
        title="Add student and login account"
        close={() => setAdding(false)}
      >
        <StudentForm
          mode="add"
          token={token}
          close={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load().catch(e => setToast(e.message));
            setToast("Student added. Dashboard updated.");
          }}
        />
      </Modal>
    )}

    {editingStudent && (
      <Modal
        title="Edit student profile"
        close={() => setEditingStudent(null)}
      >
        <ProfessorStudentEditor
          student={editingStudent}
          token={token}
          close={() => setEditingStudent(null)}
          onSaved={() => {
            setEditingStudent(null);
            setToast("Student profile updated");
            load().catch(e => setToast(e.message));
          }}
        />
      </Modal>
    )}

    {selected && (
      <ProfilePanel
        student={selected}
        token={token}
        close={() => setSelected(null)}
        onChanged={load}
      />
    )}

    {toast && (
      <Toast text={toast} onClose={() => setToast("")} />
    )}
  </div>
);
}

function ProgressRing({value,label,tone}:{value:number;label:string;tone:string}){return <div className="health-ring-wrap"><div className={`health-ring ${tone}`} style={{"--progress":`${value*3.6}deg`} as React.CSSProperties}><div><strong>{Math.round(value)}%</strong><span>{label}</span></div></div><small>{value>=75?"On track":"Needs attention"}</small></div>}
function Modal({title,children,close}:{title:string;children:React.ReactNode;close:()=>void}){return <><div className="panel-backdrop" onClick={close}/><div className="center-modal"><div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={close}><Icon name="close"/></button></div>{children}</div></>}
function StudentApp({token,user,logout,onProfile}:{token:string;user:User;logout:()=>void;onProfile:()=>void}){
 const [editing,setEditing]=useState(false);
 const [s,setS]=useState<Student|null>(null),[tab,setTab]=useState("My Dashboard"),[modal,setModal]=useState<string|null>(null),[support,setSupport]=useState(""),[toast,setToast]=useState(""),[scenario,setScenario]=useState<any>(null);
 useEffect(()=>{api<Student>("/api/student/me",token).then(setS).catch(e=>setToast(e.message))},[]);
 async function runPlan(){if(!s)return;try{const result=await api<any>(`/api/students/${s.id}/what-if`,token,{method:"POST",body:JSON.stringify({attendance:Math.max(75,s.attendance),backlogs:Math.max(0,s.backlogs-1)})});setScenario(result);setModal("plan")}catch(e){setToast((e as Error).message)}}
 async function sendSupport(){try{await api("/api/support",token,{method:"POST",body:JSON.stringify({category:"Academic support",message:support})});setSupport("");setModal(null);setToast("Support request submitted")}catch(e){setToast((e as Error).message)}}
 if(!s)return <Busy text={toast||"Loading your academic dashboard..."}/>; const top=s.shap_values?.[0];
 const resources=[{icon:"code" as IconName,tag:"DEVELOPMENT",title:"MERN Stack Essentials",desc:"12 modules · 6 hrs",tone:"violet",progress:62},{icon:"brain" as IconName,tag:"DATA SCIENCE",title:"Python for Machine Learning",desc:"8 modules · 4.5 hrs",tone:"teal",progress:35},{icon:"terminal" as IconName,tag:"SYSTEMS",title:"Linux Command Line",desc:"10 modules · 3 hrs",tone:"amber",progress:18}];
 return <div className="student-app"><header className="student-topbar"><div className="brand"><div className="brand-mark"><Icon name="sparkles" size={21}/></div><div><strong>Edu-Insight</strong><b>XAI</b></div></div><nav>{["My Dashboard","My Academics","Check Risk","Resources","Support"].map(x=><button key={x} className={tab===x?"active":""} onClick={()=>setTab(x)}>{x}</button>)}</nav><div className="student-user"><button className="profile-trigger" onClick={onProfile}><Avatar initials={s.initials} color="violet" small/><div><strong>{s.name}</strong><span>Edit profile · {s.id}</span></div></button><button className="mini-logout" onClick={logout}><Icon name="logout" size={17}/></button></div></header><main className="student-main"><div className="student-actions"><button className="secondary-button" onClick={()=>setEditing(true)}>Update my academic information</button><button className="primary-button" onClick={()=>setTab("Check Risk")}>Check my risk</button></div>{tab==="Check Risk"&&<RiskChecker token={token} student={s}/>}{tab==="My Dashboard"&&<><div className="student-hero"><div><span className="eyebrow">STUDENT ACADEMIC PORTAL</span><h1>Welcome back, {s.name.split(" ")[0]}! 👋</h1><p>Your saved academic information powers your model prediction. Update your details whenever they change.</p><div className="course-pill"><Icon name="book" size={16}/>{s.course}<i/> Semester {s.semester}<i/> VSIT</div></div><div className="hero-visual"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-badge"><Icon name="brain"/><strong>{s.risk_score}/100</strong><span>{s.risk} risk score</span></div></div></div><div className="student-grid"><div className="card academic-health"><SectionTitle title="Academic Health" subtitle="Your current saved academic indicators" action={<span className="updated-chip"><i/> Model linked</span>}/><div className="health-content"><div className="rings"><ProgressRing value={s.attendance} label="Attendance" tone="amber-ring"/><ProgressRing value={s.practical_completion} label="Practicals" tone="teal-ring"/></div><div className="health-stats"><div><span>Internal Marks</span><strong>{s.internal_marks}<span>%</span></strong></div><div><span>Estimated assignments</span><strong>{s.assignments_done}<span>/{s.assignments_total}</span></strong></div><div><span>Backlogs</span><strong className="danger">{s.backlogs}</strong></div></div></div></div><div className="card xai-card"><div className="xai-header"><div className="spark-icon"><Icon name="sparkles"/></div><div><span>MY XAI BREAKDOWN</span><h2>Your risk score, explained by SHAP</h2></div><div className="student-risk"><span>Current risk</span><RiskBadge risk={s.risk}/></div></div><div className="risk-to-action"><div className="score-block"><div className="score-ring student-score dynamic-score" style={{"--score":`${s.risk_score}%`} as React.CSSProperties}><div><strong>{s.risk_score}</strong><span>/100</span></div></div><p><b>{s.risk} risk</b><span>{s.confidence}% model confidence</span></p></div><Icon name="chevron"/><div className="why-block"><span>WHY?</span><strong>{top?.name||"Academic factors"} has the strongest contribution.</strong><p>{top?`${top.direction} this predicted risk class.`:"Explanation loading."}</p></div><Icon name="chevron"/><div className="action-block"><span>WHAT TO DO</span><strong>Test attendance/backlog improvements.</strong><p>Your result is recalculated by the real model.</p></div></div><div className="trust-note"><Icon name="brain" size={18}/><span>This is guidance from a synthetic-data prototype, not a label or final academic decision.</span><button onClick={()=>setModal("how")}>How this works</button></div></div></div><section className="toolkit-section"><SectionTitle title="Your success toolkit" subtitle="Actions connected to working dialogs"/><div className="toolkit-grid">{[["book","Syllabus & Timetable","View your semester summary","View academics","indigo","academics"],["users","What-if Planner","See how improvements change model risk","Run planner","teal","plan"],["clipboard","Intervention History","See faculty support notes","View notes","amber","notes"],["calendar","Academic Support","Send a support request","Request support","violet","support"]].map(([icon,title,desc,action,tone,key])=><div className="card toolkit-card" key={title}><div className={`tool-icon ${tone}`}><Icon name={icon as IconName}/></div><div><h3>{title}</h3><p>{desc}</p><button onClick={()=>key==="plan"?runPlan():key==="support"?setTab("Support"):setModal(key)}>{action}<Icon name="arrow" size={14}/></button></div></div>)}</div></section></>}{tab==="My Academics"&&<div className="card student-section-page"><SectionTitle title="My Academics" subtitle="Current values supplied to the risk model" action={<button className="primary-button" onClick={()=>setEditing(true)}>Edit academic details</button>}/><div className="academic-table"><div><span>Attendance</span><b>{s.attendance}%</b></div><div><span>Internal marks</span><b>{s.internal_marks}%</b></div><div><span>Practical completion</span><b>{s.practical_completion}%</b></div><div><span>Previous backlogs</span><b>{s.backlogs}</b></div><div><span>Weekly lab hours</span><b>{s.lab_hours_weekly}</b></div><div><span>Assignments estimate</span><b>{s.assignments_done}/{s.assignments_total}</b></div></div></div>}{tab==="Resources"&&<section className="resources"><SectionTitle title="Recommended for you" subtitle="Prototype learning resources"/><div className="resource-grid">{resources.map(r=><div className="card resource-card" key={r.title}><div className={`resource-art ${r.tone}`}><div className="art-grid"/><div className="resource-icon"><Icon name={r.icon} size={30}/></div><span>Learning resource</span></div><div className="resource-copy"><span>{r.tag}</span><h3>{r.title}</h3><p>{r.desc}</p><button onClick={()=>window.open(r.tone==="teal"?"https://docs.python.org/3/tutorial/":r.tone==="amber"?"https://ubuntu.com/tutorials/command-line-for-beginners":"https://developer.mozilla.org/en-US/docs/Learn_web_development","_blank","noopener,noreferrer")}>Open resource <Icon name="arrow" size={15}/></button></div></div>)}</div></section>}{tab==="Support"&&<div className="card student-section-page"><SectionTitle title="Support" subtitle="Send a request that is stored in the backend database"/><textarea className="support-textarea" value={support} onChange={e=>setSupport(e.target.value)} placeholder="Tell the faculty team what help you need..."/><button className="primary-button" disabled={support.trim().length<5} onClick={sendSupport}>Submit support request</button></div>}</main>{editing&&<Modal title="Update my student information" close={()=>setEditing(false)}><StudentForm mode="edit" token={token} student={s} close={()=>setEditing(false)} onSaved={()=>{setEditing(false);api<Student>("/api/student/me",token).then(setS);setToast("Academic details saved and risk recalculated")}}/></Modal>}{modal&&<Modal title={modal==="how"?"How your XAI score works":modal==="plan"?"What-if result":modal==="notes"?"Intervention history":modal==="academics"?"Academic summary":"Academic support"} close={()=>setModal(null)}>{modal==="how"&&<div className="modal-copy"><p>Edu-Insight sends five academic features to a Random Forest classifier. It converts class probabilities into a 0–100 risk score. SHAP then estimates each feature’s contribution to the predicted class.</p><p>The model is trained only on the synthetic CSV bundled with this project.</p></div>}{modal==="plan"&&scenario&&<div className="scenario-large"><span>Current</span><b>{scenario.before.risk_score}/100 · {scenario.before.risk}</b><Icon name="arrow"/><span>Scenario</span><b>{scenario.after.risk_score}/100 · {scenario.after.risk}</b><p>{scenario.score_change<=0?"Improvement":"Increase"}: {Math.abs(scenario.score_change)} risk-score points.</p></div>}{modal==="notes"&&<div className="modal-copy">{s.interventions?.length?s.interventions.map(n=><p key={n.id}><b>{n.professor_name}</b><br/>{n.note}</p>):<p>No faculty intervention notes yet.</p>}</div>}{modal==="academics"&&<div className="modal-copy"><p><b>{s.course}</b> · Semester {s.semester}</p><p>Attendance {s.attendance}% · Internal marks {s.internal_marks}% · Practicals {s.practical_completion}% · {s.backlogs} backlog(s).</p></div>}</Modal>}{toast&&<Toast text={toast} onClose={()=>setToast("")}/>}</div>
}


type FormData = {name:string;student_id:string;semester:number;course:string;campus:string;username:string;password:string;email:string;attendance:number;internal_marks:number;practical_completion:number;backlogs:number;lab_hours_weekly:number};
const academicFields = [["attendance","Attendance (%)",100],["internal_marks","Internal marks (%)",100],["practical_completion","Practical completion (%)",100],["backlogs","Previous backlogs",20],["lab_hours_weekly","Weekly lab hours",168]] as const;
function initialForm(student?:Student):FormData{return {name:student?.name||"",student_id:student?.id||"",semester:student?.semester||1,course:student?.course||"B.Sc. Information Technology",campus:student?.campus||"VSIT Mumbai",username:"",password:"",email:"",attendance:student?.attendance??75,internal_marks:student?.internal_marks??60,practical_completion:student?.practical_completion??70,backlogs:student?.backlogs??0,lab_hours_weekly:student?.lab_hours_weekly??4}}
function AcademicInputs({data,setData}:{data:FormData;setData:(d:FormData)=>void}){return <div className="entry-grid">{academicFields.map(([key,label,max])=><label key={key}>{label}<input required type="number" min="0" max={max} step={key==="backlogs"?"1":"0.1"} value={data[key]} onChange={e=>setData({...data,[key]:e.target.value===""?"":e.target.valueAsNumber} as FormData)}/></label>)}</div>}
function StudentForm({mode,token,student,close,onSaved,onLogin}:{mode:"register"|"add"|"edit";token?:string;student?:Student;close:()=>void;onSaved:()=>void;onLogin?:(t:string,u:User)=>void}){
 const [data,setData]=useState(initialForm(student)),[error,setError]=useState(""),[saving,setSaving]=useState(false);
 async function submit(e:FormEvent){e.preventDefault();setSaving(true);setError("");try{const result=await api<any>(mode==="register"?"/auth/register":mode==="add"?"/api/students":`/api/students/${student!.id}`,token,{method:mode==="edit"?"PUT":"POST",body:JSON.stringify(data)});if(mode==="register"){localStorage.setItem("Edu-Insight_token",result.token);onLogin?.(result.token,result.user)}onSaved()}catch(e){setError((e as Error).message)}finally{setSaving(false)}}
 return <form className="student-entry" onSubmit={submit}>{mode==="register"&&<><span className="eyebrow">Edu-Insight XAI</span><h1>Create student account</h1></>}<p>Enter your current details. Saving recalculates risk and updates the current student dashboard. Academic values are self-reported.</p><div className="entry-grid"><label>Full name<input required minLength={2} maxLength={100} value={data.name} onChange={e=>setData({...data,name:e.target.value})}/></label><label>Student ID<input required disabled={mode==="edit"} pattern="[A-Za-z0-9_-]{3,40}" value={data.student_id} onChange={e=>setData({...data,student_id:e.target.value.toUpperCase()})}/></label><label>Semester<select value={data.semester} onChange={e=>setData({...data,semester:Number(e.target.value)})}>{[1,2,3,4,5,6].map(x=><option key={x} value={x}>Semester {x}</option>)}</select></label><label>Course<input required maxLength={120} value={data.course} onChange={e=>setData({...data,course:e.target.value})}/></label><label>Campus<input required maxLength={120} value={data.campus} onChange={e=>setData({...data,campus:e.target.value})}/></label></div><h3>Academic information</h3><AcademicInputs data={data} setData={setData}/>{mode!=="edit"&&<><h3>Student login credentials</h3><div className="entry-grid"><label>Username<input required pattern="[a-zA-Z0-9_.-]{3,50}" autoComplete="username" value={data.username} onChange={e=>setData({...data,username:e.target.value})}/></label><label>Password<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={data.password} onChange={e=>setData({...data,password:e.target.value})}/></label><label>Email (optional)<input type="email" value={data.email} onChange={e=>setData({...data,email:e.target.value})}/></label></div></>}{error&&<div className="form-error" role="alert">{error}</div>}<div className="form-actions"><button type="button" className="secondary-button" onClick={close}>{mode==="register"?"Back to sign in":"Cancel"}</button><button disabled={saving} className="primary-button">{saving?"Saving…":mode==="register"?"Register and sign in":"Save student details"}</button></div></form>
}
function RiskChecker({token,student}:{token:string;student?:Student}){
 const [data,setData]=useState(initialForm(student)),[result,setResult]=useState<any>(null),[error,setError]=useState(""),[loading,setLoading]=useState(false);
 async function check(e:FormEvent){e.preventDefault();setLoading(true);setError("");setResult(null);try{setResult(await api("/api/risk-check",token,{method:"POST",body:JSON.stringify(data)}))}catch(e){setError((e as Error).message)}finally{setLoading(false)}}
 return <div className="card risk-checker"><SectionTitle title="Check academic risk" subtitle="Try any valid academic inputs. This check does not overwrite your saved record."/><form onSubmit={check}><AcademicInputs data={data} setData={setData}/>{error&&<div className="form-error" role="alert">{error}</div>}<button disabled={loading} className="primary-button">{loading?"Calculating…":"Calculate risk"}</button></form>{result&&<div className="risk-result" aria-live="polite"><RiskBadge risk={result.risk}/><h2>{result.risk_score}/100 risk score</h2><p>Model confidence: {result.confidence}%</p><div className="probabilities">{Object.entries(result.probabilities).map(([k,v])=><span key={k}>{k}: {String(v)}%</span>)}</div><h3>Why this prediction?</h3>{result.shap_values.map((x:ShapItem)=><p key={x.feature}>{x.name} ({x.value}): <b>{x.impact>0?"+":""}{x.impact.toFixed(3)}</b> contribution to the predicted {result.risk} class.</p>)}<small>SHAP explains class probability, not risk-score points. This model is trained on synthetic data.</small></div>}</div>
}
function AccountProfile({token,user}:{token:string;user:User}){
 const [name,setName]=useState(user.display_name),[email,setEmail]=useState(user.email||""),[current,setCurrent]=useState(""),[password,setPassword]=useState(""),[error,setError]=useState(""),[saving,setSaving]=useState(false);
 async function save(e:FormEvent){e.preventDefault();setSaving(true);try{await api("/api/me",token,{method:"PUT",body:JSON.stringify({display_name:name,email,current_password:current,new_password:password})});window.location.reload()}catch(e){setError((e as Error).message);setSaving(false)}}
 return <form className="student-entry" onSubmit={save}><p>{user.role==="student"?"Student":"Professor"} · {user.username}{user.student_id?` · ${user.student_id}`:""}</p><label>Display name<input required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><h3>Change password (optional)</h3><label>Current password<input type="password" autoComplete="current-password" value={current} onChange={e=>setCurrent(e.target.value)}/></label><label>New password<input type="password" minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<div className="form-error">{error}</div>}<button className="primary-button" disabled={saving}>{saving?"Saving…":"Save profile"}</button></form>
}

export default function App(){
 const [profile,setProfile]=useState(false);
 const [token,setToken]=useState(()=>localStorage.getItem("Edu-Insight_token")||""),[user,setUser]=useState<User|null>(null),[checking,setChecking]=useState(!!token);
 useEffect(()=>{if(!token){setChecking(false);return}api<User>("/api/me",token).then(u=>setUser(u)).catch(()=>{localStorage.removeItem("Edu-Insight_token");setToken("")}).finally(()=>setChecking(false))},[token]);
 function loggedIn(t:string,u:User){setToken(t);setUser(u)} function logout(){localStorage.removeItem("Edu-Insight_token");setToken("");setUser(null)}
 if(checking)return <Busy/>; if(!token||!user)return <Login onLogin={loggedIn}/>; return <>{user.role==="professor"?<FacultyApp token={token} user={user} logout={logout} onProfile={()=>setProfile(true)}/>:<StudentApp token={token} user={user} logout={logout} onProfile={()=>setProfile(true)}/>} {profile&&<Modal title="My profile" close={()=>setProfile(false)}><AccountProfile token={token} user={user}/></Modal>}</>;
}

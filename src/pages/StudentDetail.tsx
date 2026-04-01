import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { User, Mail, Phone, MapPin } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, eachDayOfInterval, parseISO, isSameDay } from 'date-fns';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { currentAcademicYearLabel } from '@/lib/academicYear';

const tabs = ['Attendance', 'Marks', 'Fee History', 'Timeline'];

type Student = {
  id: string;
  full_name: string;
  roll_number: string;
  class: string;
  section: string;
  parent_phone: string | null;
  parent_email: string | null;
  address: string | null;
  photo_url: string | null;
};

const StudentDetail = () => {
  const { id } = useParams();
  const { userProfile, schoolId } = useApp();
  const role = userProfile?.role ?? 'admin';
  const [activeTab, setActiveTab] = useState(0);
  const [student, setStudent] = useState<Student | null>(null);
  const [attendanceRows, setAttendanceRows] = useState<{ date: string; status: string }[]>([]);
  const [marksJoint, setMarksJoint] = useState<
    { subject: string; max: number; obtained: number; grade: string | null; exam: string }[]
  >([]);
  const [trend, setTrend] = useState<{ exam: string; percentage: number }[]>([]);
  const [feePaid, setFeePaid] = useState(0);
  const [feeTotal, setFeeTotal] = useState(0);
  const [payments, setPayments] = useState<
    { payment_date: string; amount_paid: number; receipt_number: string; payment_mode: string }[]
  >([]);
  const [timeline, setTimeline] = useState<{ date: string; action: string }[]>([]);

  useEffect(() => {
    if (!id || !schoolId) return;
    void (async () => {
      const { data: s } = await supabase
        .from('students')
        .select('*')
        .eq('id', id)
        .eq('school_id', schoolId)
        .maybeSingle();
      if (s) setStudent(s as Student);

      const { data: att } = await supabase
        .from('attendance')
        .select('date, status')
        .eq('school_id', schoolId)
        .eq('student_id', id)
        .order('date', { ascending: false })
        .limit(400);
      setAttendanceRows((att ?? []) as { date: string; status: string }[]);

      const { data: marksData } = await supabase
        .from('marks')
        .select('marks_obtained, max_marks, grade, subjects(name), exams(name)')
        .eq('school_id', schoolId)
        .eq('student_id', id);
      const mj = (marksData ?? []).map((m: Record<string, unknown>) => {
        const sub = m.subjects as { name?: string } | null;
        const ex = m.exams as { name?: string } | null;
        return {
          subject: sub?.name ?? '—',
          max: Number(m.max_marks),
          obtained: Number(m.marks_obtained),
          grade: (m.grade as string) ?? null,
          exam: ex?.name ?? '—',
        };
      });
      setMarksJoint(mj);

      const byExam = new Map<string, { tot: number; max: number }>();
      mj.forEach((row) => {
        const k = row.exam;
        if (!byExam.has(k)) byExam.set(k, { tot: 0, max: 0 });
        const e = byExam.get(k)!;
        e.tot += row.obtained;
        e.max += row.max;
      });
      setTrend(
        Array.from(byExam.entries()).map(([exam, v]) => ({
          exam,
          percentage: v.max ? Math.round((v.tot / v.max) * 100) : 0,
        }))
      );

      const year = currentAcademicYearLabel();
      const { data: fee } = await supabase
        .from('fees')
        .select('total_fee_amount')
        .eq('student_id', id)
        .eq('academic_year', year)
        .maybeSingle();
      setFeeTotal(fee ? Number((fee as { total_fee_amount: number }).total_fee_amount) : 0);

      const { data: pays } = await supabase
        .from('fee_payments')
        .select('payment_date, amount_paid, receipt_number, payment_mode')
        .eq('student_id', id)
        .order('payment_date', { ascending: false });
      const plist = (pays ?? []) as typeof payments;
      setPayments(plist);
      setFeePaid(plist.reduce((a, p) => a + Number(p.amount_paid), 0));

      const tl: { date: string; action: string }[] = [];
      plist.slice(0, 8).forEach((p) => {
        tl.push({
          date: p.payment_date,
          action: `Fee ₹${Number(p.amount_paid).toLocaleString()} (${p.payment_mode}) — ${p.receipt_number}`,
        });
      });
      const { data: recentAtt } = await supabase
        .from('attendance')
        .select('date, status')
        .eq('student_id', id)
        .order('date', { ascending: false })
        .limit(5);
      (recentAtt ?? []).forEach((a: { date: string; status: string }) => {
        tl.push({ date: a.date, action: `Attendance: ${a.status}` });
      });
      setTimeline(tl);
    })();
  }, [id, schoolId]);

  const attendancePct = useMemo(() => {
    if (!attendanceRows.length) return 0;
    const present = attendanceRows.filter((a) => a.status === 'present').length;
    return Math.round((present / attendanceRows.length) * 100);
  }, [attendanceRows]);

  const heatmapDays = useMemo(() => {
    const end = new Date();
    const start = subDays(end, 29);
    const days = eachDayOfInterval({ start, end });
    return days.map((day) => {
      const hit = attendanceRows.find((a) => isSameDay(parseISO(a.date + 'T12:00:00'), day));
      let status: 'present' | 'absent' | 'late' | 'none' = 'none';
      if (hit) {
        if (hit.status === 'present') status = 'present';
        else if (hit.status === 'absent') status = 'absent';
        else status = 'late';
      }
      return { day: format(day, 'd'), status, label: format(day, 'MMM d') };
    });
  }, [attendanceRows]);

  if (!student) {
    return (
      <DashboardLayout role={role} title="Student Details">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </DashboardLayout>
    );
  }

  const displayClass = `${student.class}-${student.section}`;
  const feeOk = feeTotal > 0 && feePaid >= feeTotal;

  return (
    <DashboardLayout role={role} title="Student Details">
      <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
        <div className="card-elevated p-6">
          <div className="flex flex-col sm:flex-row items-start gap-5">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 overflow-hidden flex items-center justify-center shrink-0">
              {student.photo_url ? (
                <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-foreground">{student.full_name}</h2>
                <span className={feeOk ? 'badge-paid' : 'badge-unpaid'}>
                  {feeOk ? 'Fees Paid' : 'Fees Due'}
                </span>
              </div>
              <p className="text-muted-foreground text-sm mt-1">
                Class {displayClass} • Roll #{student.roll_number}
              </p>
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                {student.parent_phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    {student.parent_phone}
                  </span>
                )}
                {student.parent_email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    {student.parent_email}
                  </span>
                )}
                {student.address && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {student.address}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex border-b gap-1 flex-wrap">
          {tabs.map((t, i) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTab(i)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === i
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {activeTab === 0 && (
          <div className="card-elevated p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Attendance (last 30 days)</h3>
              <span className="text-2xl font-bold text-primary">{attendancePct}%</span>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5">
              {heatmapDays.map((d, i) => (
                <div
                  key={i}
                  title={d.label}
                  className={`aspect-square rounded-md flex items-center justify-center text-xs font-medium ${
                    d.status === 'present'
                      ? 'bg-emerald-100 text-emerald-700'
                      : d.status === 'absent'
                        ? 'bg-red-100 text-red-700'
                        : d.status === 'late'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {d.day}
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-4 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-emerald-100" /> Present
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-red-100" /> Absent
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-amber-100" /> Late
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-muted" /> No record
              </span>
            </div>
          </div>
        )}

        {activeTab === 1 && (
          <div className="space-y-5">
            <div className="card-elevated overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Subject</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Exam</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Max</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Obtained</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {marksJoint.map((m, idx) => (
                    <tr key={idx} className="border-b table-row-hover">
                      <td className="px-4 py-3 text-foreground">{m.subject}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{m.exam}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{m.max}</td>
                      <td className="px-4 py-3 text-center font-medium text-foreground">{m.obtained}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="badge-paid">{m.grade ?? '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {trend.length > 0 && (
              <div className="card-elevated p-5">
                <h3 className="font-semibold text-foreground mb-3">Performance Trend</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 90%)" />
                    <XAxis dataKey="exam" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="percentage"
                      stroke="hsl(217 91% 50%)"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {activeTab === 2 && (
          <div className="card-elevated overflow-hidden">
            <div className="p-4 border-b flex gap-6">
              <div>
                <p className="text-xs text-muted-foreground">Total Fee ({currentAcademicYearLabel()})</p>
                <p className="text-lg font-bold text-foreground">₹{feeTotal.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Paid</p>
                <p className="text-lg font-bold text-foreground">₹{feePaid.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className="text-lg font-bold text-destructive">
                  ₹{Math.max(0, feeTotal - feePaid).toLocaleString()}
                </p>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Receipt</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Mode</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((f) => (
                  <tr key={f.receipt_number} className="border-b table-row-hover">
                    <td className="px-4 py-3 text-foreground">{f.payment_date}</td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      ₹{Number(f.amount_paid).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-primary text-xs font-mono">{f.receipt_number}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.payment_mode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 3 && (
          <div className="card-elevated p-5">
            <div className="space-y-4">
              {timeline.length === 0 && (
                <p className="text-sm text-muted-foreground">No recent activity.</p>
              )}
              {timeline.map((t, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1.5" />
                    {i < timeline.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm text-foreground">{t.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StudentDetail;

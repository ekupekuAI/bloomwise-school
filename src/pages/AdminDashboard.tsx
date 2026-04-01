import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  AlertTriangle,
  CheckCircle,
  BookOpen,
  UserPlus,
  ClipboardCheck,
  IndianRupee,
  PenLine,
  DollarSign,
  Activity,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { currentAcademicYearLabel } from '@/lib/academicYear';

const quickActions = [
  { label: 'Add Student', icon: UserPlus, to: '/add-student' },
  { label: 'Mark Attendance', icon: ClipboardCheck, to: '/attendance' },
  { label: 'Collect Fee', icon: IndianRupee, to: '/fees' },
  { label: 'Enter Marks', icon: PenLine, to: '/marks-entry' },
];

const activityIcons: Record<string, typeof DollarSign> = {
  fee: DollarSign,
  attendance: ClipboardCheck,
  student: UserPlus,
  marks: PenLine,
  alert: AlertTriangle,
};

const AdminDashboard = () => {
  const { schoolId } = useApp();
  const [totalStudents, setTotalStudents] = useState(0);
  const [defaulters, setDefaulters] = useState(0);
  const [presentPct, setPresentPct] = useState(0);
  const [upcomingExams, setUpcomingExams] = useState(0);
  const [feeChart, setFeeChart] = useState<{ month: string; collected: number; pending: number }[]>(
    []
  );
  const [activity, setActivity] = useState<{ id: string; action: string; time: string; type: string }[]>([]);

  const load = useCallback(async () => {
    if (!schoolId) return;
    const year = currentAcademicYearLabel();
    const { count: stuCount } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('is_active', true);
    setTotalStudents(stuCount ?? 0);

    const { data: studs } = await supabase.from('students').select('id').eq('school_id', schoolId).eq('is_active', true);
    const ids = (studs ?? []).map((s: { id: string }) => s.id);
    let def = 0;
    if (ids.length) {
      const { data: fees } = await supabase
        .from('fees')
        .select('student_id, total_fee_amount')
        .eq('school_id', schoolId)
        .eq('academic_year', year)
        .in('student_id', ids);
      const { data: pays } = await supabase
        .from('fee_payments')
        .select('student_id, amount_paid')
        .eq('school_id', schoolId)
        .in('student_id', ids);
      const paid: Record<string, number> = {};
      (pays ?? []).forEach((p: { student_id: string; amount_paid: number }) => {
        paid[p.student_id] = (paid[p.student_id] ?? 0) + Number(p.amount_paid);
      });
      const total: Record<string, number> = {};
      (fees ?? []).forEach((f: { student_id: string; total_fee_amount: number }) => {
        total[f.student_id] = Number(f.total_fee_amount);
      });
      ids.forEach((id: string) => {
        const t = total[id] ?? 0;
        const p = paid[id] ?? 0;
        if (t > 0 && p < t) def += 1;
      });
    }
    setDefaulters(def);

    const today = new Date().toISOString().slice(0, 10);
    const { data: attToday } = await supabase
      .from('attendance')
      .select('status')
      .eq('school_id', schoolId)
      .eq('date', today);
    const list = attToday ?? [];
    const pres = list.filter((a: { status: string }) => a.status === 'present').length;
    setPresentPct(list.length ? Math.round((pres / list.length) * 100) : 0);

    const { count: exCount } = await supabase
      .from('exams')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId);
    setUpcomingExams(exCount ?? 0);

    const months: { month: string; collected: number; pending: number }[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleString('default', { month: 'short' });
      const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
      const { data: pmts } = await supabase
        .from('fee_payments')
        .select('amount_paid')
        .eq('school_id', schoolId)
        .gte('payment_date', start)
        .lte('payment_date', end);
      const collected = (pmts ?? []).reduce(
        (a: number, p: { amount_paid: number }) => a + Number(p.amount_paid),
        0
      );
      months.push({ month: label, collected, pending: Math.max(0, def * 5000 - collected) });
    }
    setFeeChart(months);

    const { data: recentPay } = await supabase
      .from('fee_payments')
      .select('amount_paid, payment_date, students(full_name)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(3);
    const act: typeof activity = [];
    (recentPay ?? []).forEach((r: Record<string, unknown>, idx: number) => {
      const st = r.students as { full_name?: string } | null;
      act.push({
        id: `p-${idx}`,
        action: `Fee collected from ${st?.full_name ?? 'student'} (₹${r.amount_paid})`,
        time: String(r.payment_date),
        type: 'fee',
      });
    });
    setActivity(
      act.length
        ? act
        : [
            {
              id: '1',
              action: 'Welcome — add students to see live activity',
              time: 'Now',
              type: 'student',
            },
          ]
    );
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = [
    { label: 'Total Students', value: String(totalStudents), icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Fee Defaulters', value: String(defaulters), icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10' },
    { label: 'Present Today', value: `${presentPct}%`, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Exams recorded', value: String(upcomingExams), icon: BookOpen, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <DashboardLayout role="admin" title="Admin Dashboard">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="stat-card flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${s.bg} flex items-center justify-center`}>
              <s.icon className={`w-6 h-6 ${s.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-5 mb-6">
        <div className="lg:col-span-2 card-elevated p-5">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Recent Activity
          </h3>
          <div className="space-y-3">
            {activity.map((a) => {
              const Icon = activityIcons[a.type] || Activity;
              return (
                <div key={a.id} className="flex items-start gap-3 text-sm">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-foreground">{a.action}</p>
                    <p className="text-muted-foreground text-xs">{a.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="lg:col-span-3 card-elevated p-5">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Fee Collection (Last 6 Months)
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={feeChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${v / 1000}k`} />
              <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
              <Legend />
              <Bar dataKey="collected" fill="hsl(217 91% 50%)" radius={[4, 4, 0, 0]} name="Collected" />
              <Bar dataKey="pending" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} name="Pending (approx.)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" /> Quick Actions
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((a) => (
            <Link key={a.label} to={a.to} className="btn-quick-action">
              <a.icon className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;

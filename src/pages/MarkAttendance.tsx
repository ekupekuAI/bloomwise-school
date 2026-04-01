import { useCallback, useEffect, useState } from 'react';
import { Check, X, Clock, Users as UsersIcon, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';

type Status = 'present' | 'absent' | 'late';

type StudentRow = {
  id: string;
  full_name: string;
  roll_number: string;
  class: string;
  section: string;
};

const MarkAttendance = () => {
  const { schoolId, userProfile } = useApp();
  const role = userProfile?.role ?? 'admin';

  const [classOptions, setClassOptions] = useState<string[]>([]);
  const [selectedClassKey, setSelectedClassKey] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Status>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) return;
    void (async () => {
      const { data } = await supabase
        .from('students')
        .select('class, section')
        .eq('school_id', schoolId)
        .eq('is_active', true);
      const uniq = Array.from(
        new Set((data ?? []).map((r: { class: string; section: string }) => `${r.class}-${r.section}`))
      ).sort();
      setClassOptions(uniq);
      setSelectedClassKey((prev) => (prev && uniq.includes(prev) ? prev : uniq[0] || ''));
    })();
  }, [schoolId]);

  const loadStudentsAndAttendance = useCallback(async () => {
    if (!schoolId || !selectedClassKey) {
      setStudents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [c, s] = selectedClassKey.split('-');
    const { data: studs, error: e1 } = await supabase
      .from('students')
      .select('id, full_name, roll_number, class, section')
      .eq('school_id', schoolId)
      .eq('class', c)
      .eq('section', s)
      .eq('is_active', true)
      .order('roll_number');
    if (e1) {
      toast.error(e1.message);
      setLoading(false);
      return;
    }
    const list = (studs ?? []) as StudentRow[];
    setStudents(list);
    const ids = list.map((x) => x.id);
    const next: Record<string, Status> = {};
    if (ids.length) {
      const { data: att, error: e2 } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('school_id', schoolId)
        .eq('date', date)
        .in('student_id', ids);
      if (e2) toast.error(e2.message);
      (att ?? []).forEach((a: { student_id: string; status: Status }) => {
        next[a.student_id] = a.status;
      });
    }
    const merged: Record<string, Status> = {};
    list.forEach((st) => {
      merged[st.id] = next[st.id] ?? 'present';
    });
    setAttendance(merged);
    setLoading(false);
  }, [schoolId, selectedClassKey, date]);

  useEffect(() => {
    void loadStudentsAndAttendance();
  }, [loadStudentsAndAttendance]);

  const toggle = (id: string, status: Status) => {
    setAttendance((prev) => ({ ...prev, [id]: prev[id] === status ? 'present' : status }));
  };

  const getStatus = (id: string): Status => attendance[id] ?? 'present';

  const markAllPresent = () => {
    const all: Record<string, Status> = {};
    students.forEach((s) => {
      all[s.id] = 'present';
    });
    setAttendance(all);
    toast.success('All marked present');
  };

  const submit = async () => {
    if (!schoolId || !userProfile || !students.length) return;
    const rows = students.map((s) => ({
      school_id: schoolId,
      student_id: s.id,
      date,
      status: getStatus(s.id),
      marked_by: userProfile.id,
    }));
    const { error } = await supabase.from('attendance').upsert(rows, {
      onConflict: 'student_id,date',
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Attendance saved');
  };

  return (
    <DashboardLayout role={role} title="Mark Attendance">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="card-elevated p-5 flex flex-col sm:flex-row gap-3">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sm:w-44" />
          <select
            className="text-sm border rounded-lg px-3 py-2 bg-card text-foreground"
            value={selectedClassKey}
            onChange={(e) => setSelectedClassKey(e.target.value)}
          >
            {classOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={markAllPresent} className="gap-1.5 ml-auto" type="button">
            <UsersIcon className="w-3.5 h-3.5" /> Select All Present
          </Button>
        </div>

        <div className="card-elevated overflow-hidden animate-slide-up">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : (
            students.map((s) => {
              const status = getStatus(s.id);
              return (
                <div key={s.id} className="flex items-center justify-between px-5 py-3 border-b table-row-hover">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.full_name}</p>
                      <p className="text-xs text-muted-foreground">Roll #{s.roll_number}</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {(
                      [
                        ['present', 'bg-emerald-500', Check],
                        ['absent', 'bg-red-500', X],
                        ['late', 'bg-amber-500', Clock],
                      ] as const
                    ).map(([st, bg, Icon]) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => toggle(s.id, st)}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                          status === st
                            ? `${bg} text-primary-foreground shadow-sm`
                            : 'bg-muted text-muted-foreground hover:bg-accent'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <Button className="w-full" type="button" onClick={() => void submit()} disabled={!students.length}>
          Submit Attendance
        </Button>
      </div>
    </DashboardLayout>
  );
};

export default MarkAttendance;

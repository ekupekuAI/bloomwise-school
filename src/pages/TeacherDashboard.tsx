import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, PenLine, Users, BookOpen, CheckCircle2, Circle } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { toLocalISODate } from '@/lib/dates';
import { classKey, parseClassKey, uniqueClassKeys } from '@/lib/classes';

type ClassRow = { key: string; students: number; marked: number };

const TeacherDashboard = () => {
  const { schoolId, userProfile, school } = useApp();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<{ name: string; class: string; section: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId || !userProfile) return;
    void (async () => {
      const today = toLocalISODate();
      const [{ data: studs }, { data: att }, { data: subs }] = await Promise.all([
        supabase.from('students').select('id, class, section').eq('school_id', schoolId).eq('is_active', true),
        supabase.from('attendance').select('student_id').eq('school_id', schoolId).eq('date', today),
        supabase
          .from('subjects')
          .select('name, class, section')
          .eq('school_id', schoolId)
          .eq('teacher_id', userProfile.id)
          .order('class'),
      ]);
      const list = (studs ?? []) as { id: string; class: string; section: string }[];
      const markedIds = new Set((att ?? []).map((a: { student_id: string }) => a.student_id));
      setClasses(
        uniqueClassKeys(list).map((key) => {
          const inClass = list.filter((s) => classKey(s.class, s.section) === key);
          return { key, students: inClass.length, marked: inClass.filter((s) => markedIds.has(s.id)).length };
        })
      );
      setSubjects((subs ?? []) as { name: string; class: string; section: string }[]);
      setLoading(false);
    })();
  }, [schoolId, userProfile]);

  const totalStudents = classes.reduce((a, c) => a + c.students, 0);
  const pendingClasses = classes.filter((c) => c.marked < c.students).length;

  return (
    <DashboardLayout role="teacher" title="Teacher Dashboard">
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="grid sm:grid-cols-2 gap-3">
            <Link to="/attendance" className="btn-quick-action justify-center py-5">
              <ClipboardCheck className="w-5 h-5 text-primary" />
              <span className="font-medium text-foreground">Mark Attendance</span>
            </Link>
            <Link to="/marks-entry" className="btn-quick-action justify-center py-5">
              <PenLine className="w-5 h-5 text-primary" />
              <span className="font-medium text-foreground">Enter Marks</span>
            </Link>
          </div>

          <div className="card-elevated p-5">
            <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-primary" /> Today's attendance
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {loading
                ? 'Loading…'
                : classes.length === 0
                  ? 'No students have been added to your school yet.'
                  : pendingClasses
                    ? `${pendingClasses} of ${classes.length} classes still to mark`
                    : 'All classes marked for today'}
            </p>
            <div className="space-y-2">
              {classes.map((c) => {
                const { cls, section } = parseClassKey(c.key);
                const done = c.students > 0 && c.marked === c.students;
                return (
                  <div key={c.key} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    {done ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground" aria-hidden />
                    )}
                    <span className="text-sm font-medium text-foreground">
                      Class {cls}-{section}
                    </span>
                    <span className="text-sm text-muted-foreground ml-auto">
                      {done ? 'Marked' : `${c.marked}/${c.students} marked`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="card-elevated p-5">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> {school?.name ?? 'Your school'}
            </h3>
            <p className="text-2xl font-bold text-foreground">{loading ? '—' : totalStudents}</p>
            <p className="text-sm text-muted-foreground">active students in {classes.length} classes</p>
          </div>

          <div className="card-elevated p-5">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" /> My subjects
            </h3>
            {subjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No subjects assigned to you yet. Your admin creates subjects when entering marks.
              </p>
            ) : (
              <ul className="space-y-2">
                {subjects.map((s, i) => (
                  <li key={i} className="p-3 rounded-lg bg-muted/50 text-sm flex justify-between">
                    <span className="text-foreground">{s.name}</span>
                    <span className="text-muted-foreground">
                      {s.class}-{s.section}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TeacherDashboard;

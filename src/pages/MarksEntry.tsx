import { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { gradeFromMarks } from '@/lib/grades';
import { toast } from 'sonner';

type ExamType = 'unit_test' | 'mid_term' | 'final';

const examTypes: { value: ExamType; label: string }[] = [
  { value: 'unit_test', label: 'Unit test' },
  { value: 'mid_term', label: 'Mid term' },
  { value: 'final', label: 'Final' },
];

const MarksEntry = () => {
  const { schoolId, userProfile } = useApp();
  const role = userProfile?.role ?? 'admin';

  const [classOptions, setClassOptions] = useState<string[]>([]);
  const [selectedClassKey, setSelectedClassKey] = useState('');
  const [subjectName, setSubjectName] = useState('Mathematics');
  const [examName, setExamName] = useState('Unit Test 1');
  const [examType, setExamType] = useState<ExamType>('unit_test');
  const [examDate, setExamDate] = useState(new Date().toISOString().split('T')[0]);
  const [maxMarks, setMaxMarks] = useState(100);
  const [students, setStudents] = useState<{ id: string; full_name: string; roll_number: string }[]>([]);
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [examId, setExamId] = useState<string | null>(null);

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

  const loadStudents = useCallback(async () => {
    if (!schoolId || !selectedClassKey) return;
    const [c, s] = selectedClassKey.split('-');
    const { data } = await supabase
      .from('students')
      .select('id, full_name, roll_number')
      .eq('school_id', schoolId)
      .eq('class', c)
      .eq('section', s)
      .eq('is_active', true)
      .order('roll_number');
    setStudents((data ?? []) as typeof students);
    setMarks({});
  }, [schoolId, selectedClassKey]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    setSubjectId(null);
    setExamId(null);
  }, [selectedClassKey, subjectName, examName, examType, examDate]);

  const resolveSubjectAndExam = async (): Promise<{ subId: string; exId: string } | null> => {
    if (!schoolId || !selectedClassKey || !userProfile) return null;
    const [c, sec] = selectedClassKey.split('-');

    let sub = subjectId;
    if (!sub) {
      const { data: existing } = await supabase
        .from('subjects')
        .select('id')
        .eq('school_id', schoolId)
        .eq('class', c)
        .eq('section', sec)
        .eq('name', subjectName.trim())
        .maybeSingle();
      if (existing) {
        sub = (existing as { id: string }).id;
      } else if (role === 'admin') {
        const { data: ins, error } = await supabase
          .from('subjects')
          .insert({
            school_id: schoolId,
            name: subjectName.trim(),
            class: c,
            section: sec,
            teacher_id: userProfile.role === 'teacher' ? userProfile.id : null,
          })
          .select('id')
          .single();
        if (error) {
          toast.error(error.message);
          return null;
        }
        sub = (ins as { id: string }).id;
      } else {
        toast.error(
          'Subject not found. Ask your admin to add subjects for this class.'
        );
        return null;
      }
    }

    let ex = examId;
    if (!ex) {
      const { data: existingEx } = await supabase
        .from('exams')
        .select('id')
        .eq('school_id', schoolId)
        .eq('class', c)
        .eq('section', sec)
        .eq('name', examName.trim())
        .eq('type', examType)
        .maybeSingle();
      if (existingEx) {
        ex = (existingEx as { id: string }).id;
      } else if (role === 'admin') {
        const { data: insE, error: e2 } = await supabase
          .from('exams')
          .insert({
            school_id: schoolId,
            name: examName.trim(),
            type: examType,
            class: c,
            section: sec,
            date: examDate,
          })
          .select('id')
          .single();
        if (e2) {
          toast.error(e2.message);
          return null;
        }
        ex = (insE as { id: string }).id;
      } else {
        toast.error('Exam not found. Ask your admin to create this exam.');
        return null;
      }
    }

    setSubjectId(sub);
    setExamId(ex);
    return { subId: sub, exId: ex };
  };

  const saveAll = async () => {
    if (!schoolId || !students.length) return;
    const pair = await resolveSubjectAndExam();
    if (!pair) return;

    const rows = students
      .map((s) => {
        const raw = marks[s.id];
        if (raw === undefined || Number.isNaN(raw)) return null;
        const g = gradeFromMarks(raw, maxMarks);
        return {
          school_id: schoolId,
          student_id: s.id,
          exam_id: pair.exId,
          subject_id: pair.subId,
          marks_obtained: raw,
          max_marks: maxMarks,
          grade: g,
        };
      })
      .filter(Boolean) as Record<string, unknown>[];

    if (!rows.length) {
      toast.error('Enter at least one mark');
      return;
    }

    const { error } = await supabase.from('marks').upsert(rows, {
      onConflict: 'student_id,exam_id,subject_id',
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Marks saved');
  };

  return (
    <DashboardLayout role={role} title="Marks Entry">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="card-elevated p-5 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <Label>Class</Label>
              <select
                className="w-full mt-1 text-sm border rounded-lg px-3 py-2 bg-card text-foreground"
                value={selectedClassKey}
                onChange={(e) => setSelectedClassKey(e.target.value)}
              >
                {classOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Subject</Label>
              <Input className="mt-1" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} />
            </div>
            <div>
              <Label>Max marks</Label>
              <Input
                type="number"
                className="mt-1"
                value={maxMarks}
                onChange={(e) => setMaxMarks(Number(e.target.value) || 100)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Exam name</Label>
              <Input className="mt-1" value={examName} onChange={(e) => setExamName(e.target.value)} />
            </div>
            <div>
              <Label>Exam type</Label>
              <select
                className="w-full mt-1 text-sm border rounded-lg px-3 py-2 bg-card text-foreground"
                value={examType}
                onChange={(e) => setExamType(e.target.value as ExamType)}
              >
                {examTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Exam date</Label>
              <Input type="date" className="mt-1" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
            </div>
          </div>
          {role === 'teacher' && (
            <p className="text-xs text-muted-foreground">
              Teachers can save marks only for subjects and exams your admin has already created for this class.
              Use the same exam name and type as configured.
            </p>
          )}
        </div>

        <div className="card-elevated overflow-hidden animate-slide-up">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Student</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">
                  Marks / {maxMarks}
                </th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Grade</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b table-row-hover">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{s.full_name}</p>
                    <p className="text-xs text-muted-foreground">Roll #{s.roll_number}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="number"
                      min={0}
                      max={maxMarks}
                      className="w-20 mx-auto text-center"
                      value={marks[s.id] ?? ''}
                      onChange={(e) =>
                        setMarks((prev) => ({ ...prev, [s.id]: Number(e.target.value) }))
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {marks[s.id] !== undefined && !Number.isNaN(marks[s.id]) && (
                      <span className="badge-paid">{gradeFromMarks(marks[s.id], maxMarks)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Button className="w-full gap-1.5" type="button" onClick={() => void saveAll()}>
          <Save className="w-3.5 h-3.5" /> Save All
        </Button>
      </div>
    </DashboardLayout>
  );
};

export default MarksEntry;

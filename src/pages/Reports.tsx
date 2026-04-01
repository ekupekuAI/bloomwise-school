import { useCallback, useEffect, useState } from 'react';
import { FileText, Download, User } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';
import { Button } from '@/components/ui/button';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { gradeFromPercentage } from '@/lib/grades';
import { toast } from 'sonner';

type StudentRow = {
  id: string;
  full_name: string;
  roll_number: string;
  class: string;
  section: string;
  attendancePct: number;
};

function buildReportPdf(opts: {
  schoolName: string;
  student: StudentRow;
  marks: { subject: string; max: number; obtained: number; grade: string }[];
}) {
  const { schoolName, student, marks } = opts;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(schoolName, 14, 16);
  doc.setFontSize(11);
  doc.text('Report card', 14, 24);
  doc.text(
    `${student.full_name} — Class ${student.class}-${student.section} — Roll ${student.roll_number}`,
    14,
    32
  );

  const body = marks.map((m) => [
    m.subject,
    String(m.max),
    String(m.obtained),
    m.grade,
  ]);
  const totalOb = marks.reduce((a, m) => a + m.obtained, 0);
  const totalMax = marks.reduce((a, m) => a + m.max, 0);
  const pct = totalMax ? (totalOb / totalMax) * 100 : 0;
  const overall = gradeFromPercentage(pct);
  body.push(['Total', String(totalMax), String(totalOb), `${pct.toFixed(1)}% / ${overall}`]);

  autoTable(doc, {
    startY: 38,
    head: [['Subject', 'Max', 'Obtained', 'Grade']],
    body,
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY;
  doc.text(`Attendance: ${student.attendancePct}%`, 14, finalY + 10);
  doc.text(`Overall grade: ${overall}`, 14, finalY + 18);

  return doc;
}

const Reports = () => {
  const { schoolId, school } = useApp();
  const schoolName = school?.name ?? 'School';

  const [classOptions, setClassOptions] = useState<string[]>([]);
  const [selectedClassKey, setSelectedClassKey] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewStudent, setPreviewStudent] = useState<StudentRow | null>(null);
  const [previewMarks, setPreviewMarks] = useState<
    { subject: string; max: number; obtained: number; grade: string }[]
  >([]);

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

  const loadReportForClass = useCallback(async () => {
    if (!schoolId || !selectedClassKey) return null;
    const [c, s] = selectedClassKey.split('-');
    const { data: studs } = await supabase
      .from('students')
      .select('id, full_name, roll_number, class, section')
      .eq('school_id', schoolId)
      .eq('class', c)
      .eq('section', s)
      .eq('is_active', true)
      .order('roll_number');
    const list = (studs ?? []) as Omit<StudentRow, 'attendancePct'>[];
    if (!list.length) return [];

    const ids = list.map((x) => x.id);
    const { data: marksRows } = await supabase
      .from('marks')
      .select('student_id, marks_obtained, max_marks, grade, subjects(name)')
      .eq('school_id', schoolId)
      .in('student_id', ids);

    const { data: attRows } = await supabase
      .from('attendance')
      .select('student_id, status')
      .eq('school_id', schoolId)
      .in('student_id', ids);

    const attMap: Record<string, { p: number; t: number }> = {};
    (attRows ?? []).forEach((a: { student_id: string; status: string }) => {
      if (!attMap[a.student_id]) attMap[a.student_id] = { p: 0, t: 0 };
      attMap[a.student_id].t += 1;
      if (a.status === 'present') attMap[a.student_id].p += 1;
    });

    const marksByStudent: Record<
      string,
      { subject: string; max: number; obtained: number; grade: string }[]
    > = {};
    (marksRows ?? []).forEach((m: Record<string, unknown>) => {
      const sid = m.student_id as string;
      const sub = m.subjects as { name?: string } | null;
      if (!marksByStudent[sid]) marksByStudent[sid] = [];
      marksByStudent[sid].push({
        subject: sub?.name ?? '—',
        max: Number(m.max_marks),
        obtained: Number(m.marks_obtained),
        grade: String(m.grade ?? ''),
      });
    });

    return list.map((st) => {
      const am = attMap[st.id];
      const pct = am && am.t > 0 ? Math.round((am.p / am.t) * 100) : 0;
      return { ...st, attendancePct: pct, marks: marksByStudent[st.id] ?? [] };
    });
  }, [schoolId, selectedClassKey]);

  const openPreview = async () => {
    const data = await loadReportForClass();
    if (!data || !data.length) {
      toast.error('No students in this class');
      return;
    }
    const first = data[0];
    setPreviewStudent({
      id: first.id,
      full_name: first.full_name,
      roll_number: first.roll_number,
      class: first.class,
      section: first.section,
      attendancePct: first.attendancePct,
    });
    setPreviewMarks(first.marks);
    setShowPreview(true);
  };

  const downloadCurrentPdf = () => {
    if (!previewStudent || !previewMarks.length) {
      toast.error('Nothing to export');
      return;
    }
    const doc = buildReportPdf({
      schoolName,
      student: previewStudent,
      marks: previewMarks,
    });
    doc.save(`report-${previewStudent.roll_number}.pdf`);
  };

  const bulkZip = async () => {
    const data = await loadReportForClass();
    if (!data?.length) {
      toast.error('No students');
      return;
    }
    const zip = new JSZip();
    for (const st of data) {
      const doc = buildReportPdf({
        schoolName,
        student: {
          id: st.id,
          full_name: st.full_name,
          roll_number: st.roll_number,
          class: st.class,
          section: st.section,
          attendancePct: st.attendancePct,
        },
        marks: st.marks,
      });
      const arr = doc.output('arraybuffer');
      zip.file(`report-${st.roll_number}.pdf`, arr);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-cards-${selectedClassKey}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('ZIP downloaded');
  };

  return (
    <DashboardLayout role="admin" title="Reports">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="card-elevated p-5">
          <h3 className="font-semibold text-foreground mb-3">Generate Report Cards</h3>
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
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
            <Button type="button" onClick={() => void openPreview()} className="gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Preview first student
            </Button>
            <Button type="button" variant="outline" className="gap-1.5" onClick={() => void bulkZip()}>
              <Download className="w-3.5 h-3.5" /> Bulk ZIP (all in class)
            </Button>
          </div>
        </div>

        {showPreview && previewStudent && (
          <div className="card-elevated p-8 animate-scale-in">
            <div className="text-center border-b pb-5 mb-5">
              <div className="mx-auto mb-3 flex justify-center">
                <BrandLogo className="h-14 w-14" />
              </div>
              <h2 className="text-xl font-bold text-foreground">{schoolName}</h2>
              <p className="text-sm text-muted-foreground">Report card (preview)</p>
            </div>

            <div className="flex items-center gap-4 mb-5 p-4 rounded-lg bg-muted/50">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <User className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{previewStudent.full_name}</p>
                <p className="text-sm text-muted-foreground">
                  Class {previewStudent.class}-{previewStudent.section} • Roll #{previewStudent.roll_number}
                </p>
              </div>
            </div>

            <table className="w-full text-sm mb-5">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Subject</th>
                  <th className="text-center px-4 py-2 font-medium text-muted-foreground">Max</th>
                  <th className="text-center px-4 py-2 font-medium text-muted-foreground">Obtained</th>
                  <th className="text-center px-4 py-2 font-medium text-muted-foreground">Grade</th>
                </tr>
              </thead>
              <tbody>
                {previewMarks.map((m, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-4 py-2 text-foreground">{m.subject}</td>
                    <td className="px-4 py-2 text-center text-muted-foreground">{m.max}</td>
                    <td className="px-4 py-2 text-center font-medium text-foreground">{m.obtained}</td>
                    <td className="px-4 py-2 text-center">
                      <span className="badge-paid">{m.grade}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid sm:grid-cols-2 gap-4 mb-5">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Attendance</p>
                <p className="font-bold text-foreground">{previewStudent.attendancePct}%</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Marks rows</p>
                <p className="font-bold text-primary">{previewMarks.length}</p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowPreview(false)}>
                Close
              </Button>
              <Button type="button" className="gap-1.5" onClick={downloadCurrentPdf}>
                <Download className="w-3.5 h-3.5" /> Download PDF
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Reports;

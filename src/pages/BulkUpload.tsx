import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { currentAcademicYearLabel } from '@/lib/academicYear';
import { toast } from 'sonner';

type RowPreview = {
  full_name: string;
  roll_number: string;
  class: string;
  section: string;
  parent_phone: string;
  parent_email: string;
  dob: string;
  gender: string;
  parent_name: string;
  address: string;
};

function normalizeHeader(h: string): string {
  return h.replace(/\*/g, '').trim().toLowerCase().replace(/\s+/g, '_');
}

function rowFromRecord(rec: Record<string, unknown>): RowPreview | null {
  const keys = Object.keys(rec);
  const map: Record<string, string> = {};
  keys.forEach((k) => {
    map[normalizeHeader(k)] = String(rec[k] ?? '').trim();
  });
  const full_name =
    map.full_name || map.name || map.student_name || map['student_name'] || '';
  const roll_number = map.roll_number || map.roll || map.roll_no || '';
  const cls = map.class || '';
  let section = map.section || '';
  if (cls && cls.includes('-') && !section) {
    const parts = cls.split('-');
    section = parts[parts.length - 1] || '';
  }
  const classOnly = cls.includes('-') ? cls.split('-')[0] : cls;
  if (!full_name || !roll_number || !classOnly) return null;
  return {
    full_name,
    roll_number,
    class: classOnly,
    section: section || 'A',
    parent_phone: map.parent_phone || map.phone || '',
    parent_email: map.parent_email || map.email || '',
    dob: map.dob || map.date_of_birth || '',
    gender: map.gender || 'Male',
    parent_name: map.parent_name || map.guardian || '',
    address: map.address || '',
  };
}

const BulkUpload = () => {
  const { schoolId } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<RowPreview[]>([]);
  const [busy, setBusy] = useState(false);

  const downloadSample = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      [
        'full_name',
        'roll_number',
        'class',
        'section',
        'parent_phone',
        'parent_email',
        'dob',
        'gender',
        'parent_name',
        'address',
      ],
      [
        'Riya Kapoor',
        '011',
        '10',
        'A',
        '9876543220',
        'parent@email.com',
        '2010-01-15',
        'Female',
        'Parent Name',
        'City',
      ],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'student_upload_template.xlsx');
  };

  const parseFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    const rows: RowPreview[] = [];
    json.forEach((rec) => {
      const r = rowFromRecord(rec);
      if (r) rows.push(r);
    });
    setPreview(rows);
    if (!rows.length) toast.error('No valid rows found. Check headers and data.');
    else toast.success(`${rows.length} row(s) ready for preview`);
  };

  const confirmUpload = async () => {
    if (!schoolId || !preview.length) return;
    setBusy(true);
    let ok = 0;
    let fail = 0;
    const year = currentAcademicYearLabel();
    for (const r of preview) {
      try {
        const { data: inserted, error } = await supabase
          .from('students')
          .insert({
            school_id: schoolId,
            full_name: r.full_name,
            roll_number: r.roll_number,
            class: r.class,
            section: r.section,
            dob: r.dob || null,
            gender: r.gender,
            parent_name: r.parent_name || null,
            parent_phone: r.parent_phone || null,
            parent_email: r.parent_email || null,
            address: r.address || null,
            is_active: true,
          })
          .select('id')
          .single();
        if (error) throw error;
        const sid = (inserted as { id: string }).id;
        await supabase.from('fees').insert({
          school_id: schoolId,
          student_id: sid,
          total_fee_amount: 0,
          academic_year: year,
        });
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    toast.success(`Uploaded: ${ok} success, ${fail} errors`);
    setPreview([]);
    setBusy(false);
  };

  return (
    <DashboardLayout role="admin" title="Bulk Upload">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="card-elevated p-6 animate-slide-up">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void parseFile(f);
              e.target.value = '';
            }}
          />
          <div
            className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:border-primary transition-colors"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) void parseFile(f);
            }}
          >
            <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium text-foreground">Drop your Excel file here</p>
            <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
          </div>
          <div className="mt-4 flex justify-center">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={downloadSample}>
              <Download className="w-3.5 h-3.5" /> Download Sample Template
            </Button>
          </div>
        </div>

        {preview.length > 0 && (
          <div className="card-elevated p-6 animate-scale-in">
            <h3 className="font-semibold text-foreground mb-3">
              Preview ({preview.length} records)
            </h3>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 sticky top-0">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Roll</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Class</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Section</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className="border-b table-row-hover">
                      <td className="px-4 py-2 text-foreground">{r.full_name}</td>
                      <td className="px-4 py-2 text-muted-foreground">{r.roll_number}</td>
                      <td className="px-4 py-2 text-muted-foreground">{r.class}</td>
                      <td className="px-4 py-2 text-muted-foreground">{r.section}</td>
                      <td className="px-4 py-2 text-muted-foreground">{r.parent_phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPreview([])}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void confirmUpload()} disabled={busy}>
                {busy ? 'Uploading…' : 'Confirm Upload'}
              </Button>
            </div>
          </div>
        )}

        <div className="card-elevated p-5">
          <h3 className="font-semibold text-foreground mb-3">Tips</h3>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Required columns: name, roll number, class (use separate section column or &quot;10-A&quot; in class).</li>
            <li>Duplicate roll numbers in the same school will fail for those rows.</li>
            <li>After upload, set fee amounts in Fee Management or edit each student.</li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default BulkUpload;

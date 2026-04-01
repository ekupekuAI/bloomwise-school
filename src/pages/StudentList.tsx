import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Upload, Eye, Pencil, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { currentAcademicYearLabel } from '@/lib/academicYear';
import { toast } from 'sonner';

type FeeStatus = 'paid' | 'unpaid' | 'overdue';

type RowStudent = {
  id: string;
  full_name: string;
  roll_number: string;
  class: string;
  section: string;
  photo_url: string | null;
};

function deriveFeeStatus(total: number, paid: number): FeeStatus {
  if (total <= 0) return paid > 0 ? 'paid' : 'unpaid';
  if (paid >= total) return 'paid';
  if (paid <= 0) return 'unpaid';
  return 'overdue';
}

const perPage = 20;

const StudentList = () => {
  const { userProfile, schoolId } = useApp();
  const role = userProfile?.role ?? 'admin';

  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [feeFilter, setFeeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<RowStudent[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [classOptions, setClassOptions] = useState<string[]>([]);
  const [feeByStudent, setFeeByStudent] = useState<
    Record<string, { total: number; paid: number; status: FeeStatus }>
  >({});
  const [attendancePct, setAttendancePct] = useState<Record<string, number>>({});

  const academicYear = currentAcademicYearLabel();

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const { data: dist } = await supabase
        .from('students')
        .select('class, section')
        .eq('school_id', schoolId)
        .eq('is_active', true);

      const uniq = Array.from(
        new Set(
          (dist ?? []).map((r) => `${(r as { class: string }).class}-${(r as { section: string }).section}`)
        )
      ).sort();
      setClassOptions(uniq);

      const buildBase = (withCount: boolean) => {
        let q = supabase
          .from('students')
          .select('*', withCount ? { count: 'exact' } : undefined)
          .eq('school_id', schoolId)
          .eq('is_active', true);
        if (search.trim()) {
          const s = search.trim().replace(/%/g, '');
          q = q.or(`full_name.ilike.%${s}%,roll_number.ilike.%${s}%`);
        }
        if (classFilter) {
          const [c, sec] = classFilter.split('-');
          q = q.eq('class', c).eq('section', sec);
        }
        return q.order('roll_number');
      };

      let list: RowStudent[] = [];
      let countTotal = 0;

      if (feeFilter) {
        const { data: allRows, error: allErr } = await buildBase(false).limit(2000);
        if (allErr) throw allErr;
        const all = (allRows ?? []) as RowStudent[];
        const allIds = all.map((s) => s.id);
        let feeMapAll: Record<string, { total: number; paid: number; status: FeeStatus }> = {};
        if (allIds.length) {
          const { data: feeRows } = await supabase
            .from('fees')
            .select('student_id, total_fee_amount')
            .eq('school_id', schoolId)
            .eq('academic_year', academicYear)
            .in('student_id', allIds);
          const { data: payRows } = await supabase
            .from('fee_payments')
            .select('student_id, amount_paid')
            .eq('school_id', schoolId)
            .in('student_id', allIds);
          const paidMap: Record<string, number> = {};
          (payRows ?? []).forEach((p: { student_id: string; amount_paid: number }) => {
            paidMap[p.student_id] = (paidMap[p.student_id] ?? 0) + Number(p.amount_paid);
          });
          const totalMap: Record<string, number> = {};
          (feeRows ?? []).forEach((f: { student_id: string; total_fee_amount: number }) => {
            totalMap[f.student_id] = Number(f.total_fee_amount);
          });
          feeMapAll = {};
          allIds.forEach((id) => {
            const total = totalMap[id] ?? 0;
            const paid = paidMap[id] ?? 0;
            feeMapAll[id] = { total, paid, status: deriveFeeStatus(total, paid) };
          });
        }
        const filtered = all.filter((s) => feeMapAll[s.id]?.status === feeFilter);
        countTotal = filtered.length;
        const from = (page - 1) * perPage;
        list = filtered.slice(from, from + perPage);
        setFeeByStudent(feeMapAll);
        const idsPage = list.map((s) => s.id);
        const { data: attRows } = await supabase
          .from('attendance')
          .select('student_id, status')
          .eq('school_id', schoolId)
          .in('student_id', idsPage.length ? idsPage : ['00000000-0000-0000-0000-000000000000']);
        const counts: Record<string, { p: number; t: number }> = {};
        (attRows ?? []).forEach((a: { student_id: string; status: string }) => {
          if (!counts[a.student_id]) counts[a.student_id] = { p: 0, t: 0 };
          counts[a.student_id].t += 1;
          if (a.status === 'present') counts[a.student_id].p += 1;
        });
        const pctMap: Record<string, number> = {};
        idsPage.forEach((id) => {
          const c = counts[id];
          pctMap[id] = c && c.t > 0 ? Math.round((c.p / c.t) * 100) : 0;
        });
        setAttendancePct(pctMap);
        setStudents(list);
        setTotalCount(countTotal);
        setLoading(false);
        return;
      }

      const from = (page - 1) * perPage;
      const to = from + perPage - 1;
      const { data: rows, count, error } = await buildBase(true).range(from, to);

      if (error) throw error;
      list = (rows ?? []) as RowStudent[];
      countTotal = count ?? list.length;
      setStudents(list);
      setTotalCount(countTotal);

      const ids = list.map((s) => s.id);
      if (ids.length === 0) {
        setFeeByStudent({});
        setAttendancePct({});
        return;
      }

      const { data: feeRows } = await supabase
        .from('fees')
        .select('student_id, total_fee_amount')
        .eq('school_id', schoolId)
        .eq('academic_year', academicYear)
        .in('student_id', ids);

      const { data: payRows } = await supabase
        .from('fee_payments')
        .select('student_id, amount_paid')
        .eq('school_id', schoolId)
        .in('student_id', ids);

      const paidMap: Record<string, number> = {};
      (payRows ?? []).forEach((p: { student_id: string; amount_paid: number }) => {
        paidMap[p.student_id] = (paidMap[p.student_id] ?? 0) + Number(p.amount_paid);
      });

      const totalMap: Record<string, number> = {};
      (feeRows ?? []).forEach((f: { student_id: string; total_fee_amount: number }) => {
        totalMap[f.student_id] = Number(f.total_fee_amount);
      });

      const feeMap: Record<string, { total: number; paid: number; status: FeeStatus }> = {};
      ids.forEach((id) => {
        const total = totalMap[id] ?? 0;
        const paid = paidMap[id] ?? 0;
        feeMap[id] = {
          total,
          paid,
          status: deriveFeeStatus(total, paid),
        };
      });
      setFeeByStudent(feeMap);

      const { data: attRows } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('school_id', schoolId)
        .in('student_id', ids);

      const counts: Record<string, { p: number; t: number }> = {};
      (attRows ?? []).forEach((a: { student_id: string; status: string }) => {
        if (!counts[a.student_id]) counts[a.student_id] = { p: 0, t: 0 };
        counts[a.student_id].t += 1;
        if (a.status === 'present') counts[a.student_id].p += 1;
      });
      const pctMap: Record<string, number> = {};
      ids.forEach((id) => {
        const c = counts[id];
        pctMap[id] = c && c.t > 0 ? Math.round((c.p / c.t) * 100) : 0;
      });
      setAttendancePct(pctMap);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [schoolId, search, classFilter, page, academicYear, feeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, classFilter, feeFilter]);

  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));

  return (
    <DashboardLayout role={role} title="Students">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search name or roll..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="text-sm border rounded-lg px-3 py-2 bg-card text-foreground"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
          >
            <option value="">All Classes</option>
            {classOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            className="text-sm border rounded-lg px-3 py-2 bg-card text-foreground"
            value={feeFilter}
            onChange={(e) => setFeeFilter(e.target.value)}
          >
            <option value="">Fee Status</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="overdue">Overdue</option>
          </select>
          {role === 'admin' && (
            <>
              <Link to="/bulk-upload">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Upload className="w-3.5 h-3.5" /> Bulk Upload
                </Button>
              </Link>
              <Link to="/add-student">
                <Button size="sm" className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Add Student
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Student</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Roll No</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Class</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fee Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Attendance</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : (
                students.map((s) => {
                  const fs = feeByStudent[s.id]?.status ?? 'unpaid';
                  const pct = attendancePct[s.id] ?? 0;
                  const displayClass = `${s.class}-${s.section}`;
                  return (
                    <tr key={s.id} className="border-b table-row-hover">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center shrink-0">
                            {s.photo_url ? (
                              <img src={s.photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-4 h-4 text-primary" />
                            )}
                          </div>
                          <span className="font-medium text-foreground">{s.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s.roll_number}</td>
                      <td className="px-4 py-3 text-muted-foreground">{displayClass}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            fs === 'paid'
                              ? 'badge-paid'
                              : fs === 'unpaid'
                                ? 'badge-unpaid'
                                : 'badge-overdue'
                          }
                        >
                          {fs.charAt(0).toUpperCase() + fs.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-muted-foreground text-xs">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link to={`/student/${s.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                          {role === 'admin' && (
                            <Link to={`/add-student?edit=${s.id}`}>
                              <Button variant="ghost" size="sm" title="Edit">
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} ({totalCount} students)
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StudentList;

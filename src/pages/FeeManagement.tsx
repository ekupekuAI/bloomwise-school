import { useCallback, useEffect, useState } from 'react';
import { IndianRupee, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { currentAcademicYearLabel } from '@/lib/academicYear';
import { generateReceiptNumber } from '@/lib/receipt';
import { toast } from 'sonner';

type ModeKey = 'cash' | 'upi' | 'bank' | 'cheque';

const modeLabel: Record<ModeKey, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank: 'Bank',
  cheque: 'Cheque',
};

type FeeRow = {
  id: string;
  full_name: string;
  class: string;
  section: string;
  total: number;
  paid: number;
  lastPayment: string | null;
};

const tabs = ['All Students', 'Paid', 'Unpaid', 'Overdue'];

const FeeManagement = () => {
  const { schoolId, userProfile, school } = useApp();
  const academicYear = currentAcademicYearLabel();

  const [activeTab, setActiveTab] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [rows, setRows] = useState<FeeRow[]>([]);
  const [stats, setStats] = useState({ collected: 0, pending: 0, defaulters: 0 });
  const [loading, setLoading] = useState(true);

  const [amount, setAmount] = useState('5000');
  const [payMode, setPayMode] = useState<ModeKey>('cash');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [receiptNo, setReceiptNo] = useState('');

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    const { data: studs } = await supabase
      .from('students')
      .select('id, full_name, class, section')
      .eq('school_id', schoolId)
      .eq('is_active', true);

    const studentList = studs ?? [];
    const ids = studentList.map((s: { id: string }) => s.id);

    const { data: feeRows } = await supabase
      .from('fees')
      .select('student_id, total_fee_amount')
      .eq('school_id', schoolId)
      .eq('academic_year', academicYear)
      .in('student_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);

    const totalMap: Record<string, number> = {};
    (feeRows ?? []).forEach((f: { student_id: string; total_fee_amount: number }) => {
      totalMap[f.student_id] = Number(f.total_fee_amount);
    });

    const { data: pays } = await supabase
      .from('fee_payments')
      .select('student_id, amount_paid, payment_date')
      .eq('school_id', schoolId)
      .in('student_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
      .order('payment_date', { ascending: false });

    const paidMap: Record<string, number> = {};
    const lastMap: Record<string, string> = {};
    (pays ?? []).forEach((p: { student_id: string; amount_paid: number; payment_date: string }) => {
      paidMap[p.student_id] = (paidMap[p.student_id] ?? 0) + Number(p.amount_paid);
      if (!lastMap[p.student_id]) lastMap[p.student_id] = p.payment_date;
    });

    const built: FeeRow[] = studentList.map((s: { id: string; full_name: string; class: string; section: string }) => {
      const total = totalMap[s.id] ?? 0;
      const paid = paidMap[s.id] ?? 0;
      return {
        id: s.id,
        full_name: s.full_name,
        class: s.class,
        section: s.section,
        total,
        paid,
        lastPayment: lastMap[s.id] ?? null,
      };
    });

    setRows(built);
    const collected = (pays ?? []).reduce(
      (a: number, p: { amount_paid: number }) => a + Number(p.amount_paid),
      0
    );
    let pending = 0;
    let def = 0;
    built.forEach((r) => {
      const bal = r.total - r.paid;
      if (bal > 0) {
        pending += bal;
        def += 1;
      }
    });
    setStats({ collected, pending, defaulters: def });
    setLoading(false);
  }, [schoolId, academicYear]);

  useEffect(() => {
    void load();
  }, [load]);

  const withStatus = (r: FeeRow) => {
    const bal = r.total - r.paid;
    if (r.total <= 0) return bal <= 0 ? 'paid' : 'unpaid';
    if (r.paid >= r.total) return 'paid';
    if (r.paid <= 0) return 'unpaid';
    return 'overdue';
  };

  const filtered = rows.filter((s) => {
    const st = withStatus(s);
    if (activeTab === 1) return st === 'paid';
    if (activeTab === 2) return st === 'unpaid';
    if (activeTab === 3) return st === 'overdue';
    return true;
  });

  const student = rows.find((s) => s.id === selectedStudent);

  const collectSubmit = async () => {
    if (!schoolId || !userProfile || !selectedStudent) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    const rec = generateReceiptNumber();
    const { data: existingFee } = await supabase
      .from('fees')
      .select('id')
      .eq('student_id', selectedStudent)
      .eq('academic_year', academicYear)
      .maybeSingle();
    if (!existingFee) {
      const { error: ie } = await supabase.from('fees').insert({
        school_id: schoolId,
        student_id: selectedStudent,
        total_fee_amount: 0,
        academic_year: academicYear,
      });
      if (ie) {
        toast.error(ie.message);
        return;
      }
    }

    const { error } = await supabase.from('fee_payments').insert({
      school_id: schoolId,
      student_id: selectedStudent,
      amount_paid: amt,
      payment_date: payDate,
      payment_mode: payMode,
      receipt_number: rec,
      note: note.trim() || null,
      created_by: userProfile.id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setReceiptNo(rec);
    await load();
    setShowReceipt(true);
    toast.success('Payment recorded');
  };

  const downloadPdfReceipt = () => {
    if (!student || !school) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(school.name, 14, 18);
    doc.setFontSize(10);
      doc.text('Fee receipt', 14, 26);
    doc.text(`Receipt: ${receiptNo}`, 14, 34);
    doc.text(`Student: ${student.full_name}`, 14, 42);
      doc.text(`Class: ${student.class}-${student.section}`, 14, 50);
    doc.text(`Amount: ₹${Number(amount).toLocaleString()}`, 14, 58);
    doc.text(`Date: ${payDate}`, 14, 66);
      doc.text(`Mode: ${modeLabel[payMode]}`, 14, 74);
    doc.save(`${receiptNo}.pdf`);
  };

  return (
    <DashboardLayout role="admin" title="Fee Management">
      <div className="grid sm:grid-cols-3 gap-4 mb-5">
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Recorded payments (year)</p>
          <p className="text-2xl font-bold text-foreground">₹{stats.collected.toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total pending balance</p>
          <p className="text-2xl font-bold text-destructive">₹{stats.pending.toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Students with balance</p>
          <p className="text-2xl font-bold text-foreground">{stats.defaulters}</p>
        </div>
      </div>

      <div className="flex border-b gap-1 mb-5 flex-wrap">
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

      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Class</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Fee</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Paid</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Balance</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Payment</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="border-b table-row-hover">
                    <td className="px-4 py-3 font-medium text-foreground">{s.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.class}-{s.section}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">₹{s.total.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-foreground">₹{s.paid.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-medium text-destructive">
                      ₹{Math.max(0, s.total - s.paid).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{s.lastPayment ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        type="button"
                        onClick={() => {
                          setSelectedStudent(s.id);
                          setShowModal(true);
                          setShowReceipt(false);
                          setReceiptNo('');
                          setAmount(String(Math.max(0, s.total - s.paid) || 1000));
                        }}
                      >
                        <IndianRupee className="w-3 h-3" /> Collect
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 bg-foreground/20 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowModal(false);
            setShowReceipt(false);
          }}
        >
          <div
            className="bg-card rounded-xl shadow-xl w-full max-w-md animate-scale-in p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {!showReceipt ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground">Collect Fee — {student?.full_name}</h3>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label>Amount</Label>
                    <Input className="mt-1" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                  <div>
                    <Label>Payment Mode</Label>
                    <select
                      className="w-full mt-1 text-sm border rounded-lg px-3 py-2 bg-card text-foreground"
                      value={payMode}
                      onChange={(e) => setPayMode(e.target.value as ModeKey)}
                    >
                      {(Object.keys(modeLabel) as ModeKey[]).map((k) => (
                        <option key={k} value={k}>
                          {modeLabel[k]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input type="date" className="mt-1" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Note</Label>
                    <Input className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
                  </div>
                </div>
                <div className="flex gap-2 mt-5">
                  <Button variant="outline" className="flex-1" type="button" onClick={() => setShowModal(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1" type="button" onClick={() => void collectSubmit()}>
                    Collect Fee
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center border-b pb-4 mb-4">
                  <h3 className="font-bold text-foreground text-lg">{school?.name ?? 'School'}</h3>
                  <p className="text-xs text-muted-foreground">Fee Receipt</p>
                </div>
                <div className="flex justify-center mb-4">
                  <QRCodeSVG value={`${school?.name ?? ''}|${receiptNo}|${amount}`} size={96} />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Student:</span>
                    <span className="text-foreground font-medium">{student?.full_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Class:</span>
                    <span className="text-foreground">
                      {student?.class}-{student?.section}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount:</span>
                    <span className="text-foreground font-bold">₹{Number(amount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date:</span>
                    <span className="text-foreground">{payDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Receipt No:</span>
                    <span className="text-primary font-mono text-xs">{receiptNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mode:</span>
                    <span className="text-foreground">{modeLabel[payMode]}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-5">
                  <Button variant="outline" className="flex-1" type="button" onClick={downloadPdfReceipt}>
                    Download PDF
                  </Button>
                  <Button
                    className="flex-1"
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setShowReceipt(false);
                    }}
                  >
                    Done
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default FeeManagement;

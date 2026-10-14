import { useCallback, useEffect, useState } from 'react';
import { Send, Bell, Clock } from 'lucide-react';
import emailjs from '@emailjs/browser';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';
import { parseClassKey, uniqueClassKeys } from '@/lib/classes';

const templates: Record<string, string> = {
  'Fee Reminder':
    'Dear Parent, this is a reminder that the school fee for the current quarter is due. Please make the payment at the earliest.',
  'Attendance Alert':
    'Dear Parent, your ward has been marked absent. Please contact the class teacher for more information.',
  'General Notice':
    'Dear Parent, this is to inform you about an upcoming event at the school. Please check the school portal for details.',
  'Exam Notice':
    'Dear Parent, the examination schedule for the current term has been released. Please ensure your ward is well-prepared.',
};

type AlertRow = {
  id: string;
  sent_at: string;
  type: string;
  recipient_type: string;
  message: string;
  status: string;
};

const ParentAlerts = () => {
  const { schoolId, userProfile, school } = useApp();
  const [msgType, setMsgType] = useState('Fee Reminder');
  const [message, setMessage] = useState(templates['Fee Reminder']);
  const [recipient, setRecipient] = useState('all');
  const [classKey, setClassKey] = useState('');
  const [via, setVia] = useState('email');
  const [history, setHistory] = useState<AlertRow[]>([]);
  const [classOptions, setClassOptions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!schoolId) return;
    const { data } = await supabase
      .from('alerts')
      .select('id, sent_at, type, recipient_type, message, status')
      .eq('school_id', schoolId)
      .order('sent_at', { ascending: false })
      .limit(100);
    setHistory((data ?? []) as AlertRow[]);
  }, [schoolId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!schoolId) return;
    void (async () => {
      const { data } = await supabase
        .from('students')
        .select('class, section')
        .eq('school_id', schoolId)
        .eq('is_active', true);
      const uniq = uniqueClassKeys(data ?? []);
      setClassOptions(uniq);
      setClassKey((prev) => (prev && uniq.includes(prev) ? prev : uniq[0] || ''));
    })();
  }, [schoolId]);

  const resolveRecipients = async (): Promise<{ emails: string[]; count: number }> => {
    if (!schoolId) return { emails: [], count: 0 };
    let q = supabase
      .from('students')
      .select('parent_email')
      .eq('school_id', schoolId)
      .eq('is_active', true);
    if (recipient === 'class' && classKey) {
      const { cls: c, section: s } = parseClassKey(classKey);
      q = q.eq('class', c).eq('section', s);
    }
    const { data } = await q;
    const emails = Array.from(
      new Set(
        (data ?? [])
          .map((r: { parent_email: string | null }) => (r.parent_email ?? '').trim())
          .filter(Boolean)
      )
    );
    return { emails, count: emails.length };
  };

  const sendAlert = async () => {
    if (!schoolId || !userProfile) return;
    if (!message.trim()) {
      toast.error('Write a message first');
      return;
    }
    const sid = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const tid = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    const pk = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
    const wantsEmail = via === 'email' || via === 'both';
    if (wantsEmail && (!sid || !tid || !pk)) {
      // Previously the alert was still logged as "sent" even though nothing went out.
      toast.error('Email is not configured: set VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID and VITE_EMAILJS_PUBLIC_KEY in .env, or choose "Log only".');
      return;
    }
    setBusy(true);
    try {
      const { emails, count } = await resolveRecipients();
      if (!count && wantsEmail) {
        toast.error('No parent emails found for this selection');
        setBusy(false);
        return;
      }
      let status = 'logged';

      const recipient_type = recipient === 'all' ? 'all_parents' : `class:${classKey}`;

      if (wantsEmail) {
        let sent = 0;
        for (const to of emails) {
          try {
            await emailjs.send(
              sid!,
              tid!,
              {
                to_email: to,
                message,
                school: school?.name ?? userProfile.full_name,
                type: msgType,
              },
              { publicKey: pk }
            );
            sent += 1;
          } catch (e) {
            console.error(e);
          }
        }
        if (sent === 0) {
          toast.error('EmailJS: no messages sent (check template variables)');
          status = 'failed';
        } else {
          toast.success(`Sent ${sent} of ${count} email(s) via EmailJS`);
          status = sent === count ? 'sent' : `partial (${sent}/${count})`;
        }
      } else {
        toast.success('Alert logged');
      }

      const { error } = await supabase.from('alerts').insert({
        school_id: schoolId,
        message,
        type: msgType,
        recipient_type,
        sent_by: userProfile.id,
        status,
      });
      if (error) throw error;

      await loadHistory();
    } catch (e) {
      console.error(e);
      toast.error('Failed to record alert');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardLayout role="admin" title="Parent Alerts">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="card-elevated p-6 animate-slide-up">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" /> Compose Alert
          </h3>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Recipients</Label>
                <select
                  className="w-full mt-1.5 text-sm border rounded-lg px-3 py-2 bg-card text-foreground"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                >
                  <option value="all">All Parents (with email)</option>
                  <option value="class">Single class</option>
                </select>
              </div>
              {recipient === 'class' && (
                <div>
                  <Label>Class</Label>
                  <select
                    className="w-full mt-1.5 text-sm border rounded-lg px-3 py-2 bg-card text-foreground"
                    value={classKey}
                    onChange={(e) => setClassKey(e.target.value)}
                  >
                    {classOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <Label>Message Type</Label>
                <select
                  className="w-full mt-1.5 text-sm border rounded-lg px-3 py-2 bg-card text-foreground"
                  value={msgType}
                  onChange={(e) => {
                    setMsgType(e.target.value);
                    setMessage(templates[e.target.value] ?? '');
                  }}
                >
                  {Object.keys(templates).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label>Message</Label>
              <Textarea className="mt-1.5" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Send via</Label>
                <select
                  className="w-full mt-1.5 text-sm border rounded-lg px-3 py-2 bg-card text-foreground"
                  value={via}
                  onChange={(e) => setVia(e.target.value)}
                >
                  <option value="email">Email (EmailJS)</option>
                  <option value="sms">Log only (no message is sent)</option>
                </select>
              </div>
            </div>
            <Button type="button" className="gap-1.5" disabled={busy} onClick={() => void sendAlert()}>
              <Send className="w-3.5 h-3.5" /> Send Alert
            </Button>
          </div>
        </div>

        <div className="card-elevated p-5">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Sent Alerts
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Recipients</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Message</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No alerts sent yet.</td>
                  </tr>
                )}
                {history.map((a) => (
                  <tr key={a.id} className="border-b table-row-hover">
                    <td className="px-4 py-3 text-foreground">
                      {a.sent_at ? new Date(a.sent_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge-paid">{a.type}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{a.recipient_type}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                      {a.message}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ParentAlerts;

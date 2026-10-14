import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ImagePlus } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { currentAcademicYearLabel } from '@/lib/academicYear';
import { toast } from 'sonner';
import { useSignedPhotoUrl } from '@/components/StudentPhoto';
import { PHOTO_BUCKET, photoPath } from '@/lib/photos';

const AddStudent = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const { schoolId, userProfile } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [cls, setCls] = useState('');
  const [section, setSection] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Male');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [address, setAddress] = useState('');
  const [annualFee, setAnnualFee] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const savedPhoto = useSignedPhotoUrl(photoUrl);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!!editId);

  useEffect(() => {
    if (!editId || !schoolId) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', editId)
        .eq('school_id', schoolId)
        .maybeSingle();
      if (error || !data) {
        toast.error('Student not found');
        navigate('/students');
        return;
      }
      const s = data as Record<string, unknown>;
      setFullName(String(s.full_name ?? ''));
      setRollNumber(String(s.roll_number ?? ''));
      setCls(String(s.class ?? ''));
      setSection(String(s.section ?? ''));
      setDob(s.dob ? String(s.dob).slice(0, 10) : '');
      setGender(String(s.gender ?? 'Male'));
      setParentName(String(s.parent_name ?? ''));
      setParentPhone(String(s.parent_phone ?? ''));
      setParentEmail(String(s.parent_email ?? ''));
      setAddress(String(s.address ?? ''));
      setPhotoUrl(s.photo_url ? String(s.photo_url) : null);
      const { data: feeRow } = await supabase
        .from('fees')
        .select('total_fee_amount')
        .eq('student_id', editId)
        .eq('academic_year', currentAcademicYearLabel())
        .maybeSingle();
      if (feeRow) setAnnualFee(String((feeRow as { total_fee_amount: number }).total_fee_amount));
      setLoading(false);
    })();
  }, [editId, schoolId, navigate]);

  useEffect(() => () => {
    if (localPreview) URL.revokeObjectURL(localPreview);
  }, [localPreview]);

  const onPhotoPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      toast.error('Choose an image under 5 MB');
      e.target.value = '';
      return;
    }
    setLocalPreview(URL.createObjectURL(file));
  };

  /** Uploads to the private bucket and returns the storage path (read later via signed URLs). */
  const uploadPhoto = async (file: File): Promise<string | null> => {
    if (!schoolId) return null;
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${schoolId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      toast.error(`Photo not uploaded: ${upErr.message}`);
      return null;
    }
    return path;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId || !userProfile) return;
    setBusy(true);
    try {
      let url = photoPath(photoUrl);
      const file = fileRef.current?.files?.[0];
      if (file) {
        const uploaded = await uploadPhoto(file);
        if (uploaded) url = uploaded;
      }

      const payload = {
        school_id: schoolId,
        full_name: fullName.trim(),
        roll_number: rollNumber.trim(),
        class: cls.trim(),
        section: section.trim(),
        dob: dob || null,
        gender,
        parent_name: parentName.trim() || null,
        parent_phone: parentPhone.trim() || null,
        parent_email: parentEmail.trim() || null,
        address: address.trim() || null,
        photo_url: url,
        is_active: true,
      };

      let studentId = editId;

      if (editId) {
        const { error } = await supabase.from('students').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from('students')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        studentId = (inserted as { id: string }).id;
      }

      const year = currentAcademicYearLabel();
      const feeNum = annualFee === '' ? 0 : Number(annualFee);
      if (studentId && !Number.isNaN(feeNum)) {
        const { data: existing } = await supabase
          .from('fees')
          .select('id')
          .eq('student_id', studentId)
          .eq('academic_year', year)
          .maybeSingle();
        const { error: feeErr } = existing
          ? await supabase
              .from('fees')
              .update({ total_fee_amount: feeNum })
              .eq('id', (existing as { id: string }).id)
          : await supabase.from('fees').insert({
              school_id: schoolId,
              student_id: studentId,
              total_fee_amount: Math.max(0, feeNum),
              academic_year: year,
            });
        if (feeErr) toast.error(`Student saved, but the fee was not: ${feeErr.message}`);
      }

      toast.success(editId ? 'Student updated' : 'Student added');
      navigate('/students');
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'Save failed';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="admin" title={editId ? 'Edit Student' : 'Add Student'}>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin" title={editId ? 'Edit Student' : 'Add Student'}>
      <div className="max-w-2xl mx-auto card-elevated p-6 animate-slide-up">
        <form onSubmit={handleSubmit} className="space-y-5">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoPicked} />
          <div className="flex justify-center mb-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Choose student photo"
              className="w-24 h-24 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden"
            >
              {localPreview || savedPhoto ? (
                <img src={localPreview || savedPhoto || ''} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus className="w-8 h-8 text-muted-foreground" />
              )}
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="st-full-name">Full Name</Label>
              <Input id="st-full-name" className="mt-1.5" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="st-roll-number">Roll Number</Label>
              <Input id="st-roll-number" className="mt-1.5" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="st-class">Class</Label>
              <Input id="st-class" className="mt-1.5" placeholder="e.g. 10" value={cls} onChange={(e) => setCls(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="st-section">Section</Label>
              <Input id="st-section" className="mt-1.5" placeholder="e.g. A" value={section} onChange={(e) => setSection(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="st-date-of-birth">Date of Birth</Label>
              <Input id="st-date-of-birth" type="date" className="mt-1.5" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="st-gender">Gender</Label>
              <select id="st-gender"
                className="w-full mt-1.5 text-sm border rounded-lg px-3 py-2 bg-card text-foreground"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <Label htmlFor="st-parent-guardian-name">Parent/Guardian Name</Label>
              <Input id="st-parent-guardian-name" className="mt-1.5" value={parentName} onChange={(e) => setParentName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="st-parent-phone">Parent Phone</Label>
              <Input id="st-parent-phone" className="mt-1.5" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="st-parent-email">Parent Email</Label>
              <Input id="st-parent-email" type="email" className="mt-1.5" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="st-annual-fee-current-year">Annual fee (current year)</Label>
              <Input id="st-annual-fee-current-year"
                type="number"
                min={0}
                className="mt-1.5"
                placeholder="0"
                value={annualFee}
                onChange={(e) => setAnnualFee(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="st-address">Address</Label>
            <Textarea id="st-address" className="mt-1.5" rows={3} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => navigate('/students')}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save Student'}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default AddStudent;

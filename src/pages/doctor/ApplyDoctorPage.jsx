/**
 * Doctor Application Form Page
 * Allows any authenticated PATIENT to apply to become a verified doctor.
 * All role changes happen server-side — frontend never escalates roles.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { submitDoctorApplication } from '../../services/api';
import {
  IconStethoscope, IconBadgeCheck, IconFileText, IconGlobe,
  IconTag, IconUsers, IconDoc, IconSend,
} from '../../components/icons';

const SPECIALIZATIONS = [
  'General Medicine', 'Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics',
  'Dermatology', 'Psychiatry', 'Gynecology', 'Ophthalmology', 'ENT',
  'Gastroenterology', 'Nephrology', 'Oncology', 'Pulmonology', 'Endocrinology',
  'Rheumatology', 'Radiology', 'Pathology', 'Anesthesiology', 'Emergency Medicine',
  'Family Medicine', 'Internal Medicine', 'Surgery', 'Urology', 'Other',
];

const LANGUAGES = ['English', 'Tamil', 'Hindi', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Other'];

const AREAS = [
  'Preventive Care', 'Chronic Disease Management', 'Pediatric Care', 'Women\'s Health',
  'Mental Health', 'Sports Medicine', 'Geriatric Care', 'Palliative Care',
  'Telemedicine', 'Emergency Care', 'Surgical Care', 'Oncology Care',
];

function StepIndicator({ step, total }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
            i < step ? 'bg-success text-white' : i === step ? 'bg-primary text-white' : 'bg-surface-alt text-muted'
          }`}>
            {i < step ? '✓' : i + 1}
          </div>
          {i < total - 1 && <div className={`w-12 h-0.5 ${i < step ? 'bg-success' : 'bg-border'}`} />}
        </div>
      ))}
    </div>
  );
}

export default function ApplyDoctorPage() {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', date_of_birth: '',
    medical_degree: '', specialization: '', registration_number: '',
    years_of_experience: 0, organization: '', professional_bio: '',
    languages: [], areas_of_practice: [],
  });
  const [files, setFiles] = useState({
    profile_photo: null, qualification_doc: null, registration_doc: null,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleArr = (k, v) => setForm(f => ({
    ...f, [k]: f[k].includes(v) ? f[k].filter(x => x !== v) : [...f[k], v]
  }));

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (Array.isArray(v)) fd.append(k, JSON.stringify(v));
        else fd.append(k, v);
      });
      if (files.profile_photo) fd.append('profile_photo', files.profile_photo);
      if (files.qualification_doc) fd.append('qualification_doc', files.qualification_doc);
      if (files.registration_doc) fd.append('registration_doc', files.registration_doc);

      await submitDoctorApplication(fd);
      success('Application submitted! You will be notified once reviewed.', 'Application Submitted');
      navigate('/apply-doctor/status');
    } catch (err) {
      toastError(err?.response?.data?.detail || 'Submission failed. Please try again.', 'Error');
    } finally {
      setLoading(false);
    }
  };

  const steps = ['Personal Info', 'Professional Info', 'Documents & More', 'Review & Submit'];

  return (
    <div className="page-container max-w-2xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="glass-card-flat p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
            <IconStethoscope size={28} style={{ color: '#fff' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold">Apply as Doctor</h1>
            <p className="text-sm text-muted">Submit your professional credentials for admin review and verification.</p>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted">Step {step + 1} of {steps.length}: {steps[step]}</span>
            <span className="text-xs text-muted">{Math.round(((step + 1) / steps.length) * 100)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-alt">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{ width: `${((step + 1) / steps.length) * 100}%`, background: 'var(--gradient-primary)' }}
            />
          </div>
        </div>
      </div>

      {/* Warning notice */}
      <div className="glass-card-flat p-4 mb-5 border-l-4" style={{ borderColor: 'var(--color-warning)' }}>
        <p className="text-xs text-warning font-semibold">Privacy Notice</p>
        <p className="text-xs text-muted mt-1">Do not include any patient information, consultation data, or private medical records in your application. Uploaded documents are stored securely and only accessible to administrators.</p>
      </div>

      {/* Step 0: Personal Info */}
      {step === 0 && (
        <div className="glass-card-flat p-6">
          <h2 className="text-base font-bold mb-4 flex items-center gap-2"><IconUsers size={16} /> Personal Information</h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="label">Full Name <span className="text-error">*</span></label>
              <input className="input" value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Dr. Full Name" />
            </div>
            <div>
              <label className="label">Email <span className="text-error">*</span></label>
              <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="doctor@example.com" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Phone</label>
                <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 9876543210" />
              </div>
              <div>
                <label className="label">Date of Birth</label>
                <input className="input" type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Profile Photo</label>
              <input type="file" accept="image/*" className="input" onChange={e => setFiles(f => ({ ...f, profile_photo: e.target.files[0] }))} />
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Professional Info */}
      {step === 1 && (
        <div className="glass-card-flat p-6">
          <h2 className="text-base font-bold mb-4 flex items-center gap-2"><IconStethoscope size={16} /> Professional Information</h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="label">Medical Degree <span className="text-error">*</span></label>
              <input className="input" value={form.medical_degree} onChange={e => set('medical_degree', e.target.value)} placeholder="MBBS, MD, MS, etc." />
            </div>
            <div>
              <label className="label">Specialization <span className="text-error">*</span></label>
              <select className="input" value={form.specialization} onChange={e => set('specialization', e.target.value)}>
                <option value="">Select specialization</option>
                {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Registration Number <span className="text-error">*</span></label>
                <input className="input" value={form.registration_number} onChange={e => set('registration_number', e.target.value)} placeholder="MCI-12345" />
              </div>
              <div>
                <label className="label">Years of Experience</label>
                <input className="input" type="number" min="0" max="60" value={form.years_of_experience} onChange={e => set('years_of_experience', Number(e.target.value))} />
              </div>
            </div>
            <div>
              <label className="label">Current Hospital / Organization</label>
              <input className="input" value={form.organization} onChange={e => set('organization', e.target.value)} placeholder="Apollo Hospitals, Chennai" />
            </div>
            <div>
              <label className="label">Professional Bio</label>
              <textarea className="input" rows={4} value={form.professional_bio} onChange={e => set('professional_bio', e.target.value)} placeholder="Brief description of your professional background and expertise..." />
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Documents & More */}
      {step === 2 && (
        <div className="glass-card-flat p-6">
          <h2 className="text-base font-bold mb-4 flex items-center gap-2"><IconFileText size={16} /> Documents & Additional Information</h2>
          <div className="flex flex-col gap-5">
            <div className="glass-card-flat p-4" style={{ border: '1px dashed var(--color-primary-light)' }}>
              <label className="label">Medical Qualification Document <span className="text-error">*</span></label>
              <p className="text-xs text-muted mb-2">Upload your degree certificate (PDF, JPG, PNG - max 10MB)</p>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="input" onChange={e => setFiles(f => ({ ...f, qualification_doc: e.target.files[0] }))} />
              {files.qualification_doc && <p className="text-xs text-success mt-1">✓ {files.qualification_doc.name}</p>}
            </div>
            <div className="glass-card-flat p-4" style={{ border: '1px dashed var(--color-primary-light)' }}>
              <label className="label">Medical Registration Certificate</label>
              <p className="text-xs text-muted mb-2">MCI/NMC registration document (PDF, JPG, PNG)</p>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="input" onChange={e => setFiles(f => ({ ...f, registration_doc: e.target.files[0] }))} />
              {files.registration_doc && <p className="text-xs text-success mt-1">✓ {files.registration_doc.name}</p>}
            </div>

            <div>
              <label className="label flex items-center gap-1"><IconGlobe size={14} /> Languages Spoken</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => toggleArr('languages', lang)}
                    className={`badge text-xs cursor-pointer transition-all ${form.languages.includes(lang) ? 'badge-primary' : 'badge-secondary'}`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label flex items-center gap-1"><IconTag size={14} /> Areas of Practice</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {AREAS.map(area => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => toggleArr('areas_of_practice', area)}
                    className={`badge text-xs cursor-pointer transition-all ${form.areas_of_practice.includes(area) ? 'badge-primary' : 'badge-secondary'}`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="glass-card-flat p-6">
          <h2 className="text-base font-bold mb-4 flex items-center gap-2"><IconBadgeCheck size={16} /> Review & Submit</h2>
          <div className="flex flex-col gap-3 text-sm">
            {[
              ['Full Name', form.full_name],
              ['Email', form.email],
              ['Medical Degree', form.medical_degree],
              ['Specialization', form.specialization],
              ['Registration No.', form.registration_number],
              ['Experience', `${form.years_of_experience} years`],
              ['Organization', form.organization || 'Not specified'],
              ['Languages', form.languages.join(', ') || 'Not specified'],
              ['Areas', form.areas_of_practice.join(', ') || 'Not specified'],
              ['Qualification Doc', files.qualification_doc?.name || '—'],
              ['Registration Doc', files.registration_doc?.name || '—'],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between items-start border-b border-border pb-2">
                <span className="text-muted text-xs w-36 shrink-0">{label}</span>
                <span className="font-medium text-right text-xs">{val}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 p-4 glass-card-flat" style={{ borderLeft: '3px solid var(--color-warning)' }}>
            <p className="text-xs text-warning font-semibold">By submitting:</p>
            <ul className="text-xs text-muted mt-1 list-disc ml-4 flex flex-col gap-1">
              <li>I confirm all information provided is accurate and truthful.</li>
              <li>I understand documents will be reviewed by the administration team.</li>
              <li>I consent to the platform storing my professional credentials securely.</li>
              <li>I have not included any patient data or private medical records.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-5">
        <button
          className="btn btn-secondary"
          onClick={() => step > 0 ? setStep(s => s - 1) : navigate(-1)}
        >
          ← {step > 0 ? 'Previous' : 'Cancel'}
        </button>
        {step < steps.length - 1 ? (
          <button
            className="btn btn-primary"
            onClick={() => setStep(s => s + 1)}
            disabled={step === 0 && (!form.full_name || !form.email)}
          >
            Next →
          </button>
        ) : (
          <button
            className="btn btn-primary flex items-center gap-2"
            onClick={handleSubmit}
            disabled={loading || !form.medical_degree || !form.specialization || !form.registration_number}
          >
            {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <IconSend size={16} />}
            {loading ? 'Submitting...' : 'Submit Application'}
          </button>
        )}
      </div>
    </div>
  );
}

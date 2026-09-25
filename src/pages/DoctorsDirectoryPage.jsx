/**
 * Public Doctors Directory
 * Shows all verified doctors. No private documents exposed.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getVerifiedDoctors } from '../services/api';
import { IconUsers, IconBadgeCheck, IconStethoscope, IconGlobe, IconDoc } from '../components/icons';

export default function DoctorsDirectoryPage() {
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [specialization, setSpecialization] = useState('');

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      getVerifiedDoctors({ search, specialization })
        .then(data => { setDoctors(data.doctors || []); setTotal(data.total || 0); })
        .catch(() => setDoctors([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [search, specialization]);

  return (
    <div className="page-container py-8 px-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--gradient-primary)' }}>
          <IconStethoscope size={32} style={{ color: '#fff' }} />
        </div>
        <h1 className="text-2xl font-black">Find a Doctor</h1>
        <p className="text-muted text-sm mt-2">Browse our verified medical professionals</p>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3 mb-6">
        <input
          className="input flex-1"
          placeholder="Search by name, specialization, bio..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <input
          className="input w-48"
          placeholder="Specialization..."
          value={specialization}
          onChange={e => setSpecialization(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-48">
          <span className="spinner" style={{ width: 36, height: 36 }} />
        </div>
      ) : doctors.length === 0 ? (
        <div className="glass-card-flat p-16 text-center">
          <IconUsers size={48} style={{ color: 'var(--color-text-secondary)', margin: '0 auto 12px' }} />
          <h3 className="font-bold mb-2">No doctors found</h3>
          <p className="text-muted text-sm">Try adjusting your search criteria.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted mb-4">{total} verified doctor{total !== 1 ? 's' : ''}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {doctors.map(doc => (
              <div
                key={doc.id}
                className="glass-card-flat p-5 cursor-pointer hover:scale-102 transition-transform"
                onClick={() => navigate(`/doctors/${doc.id}`)}
              >
                {/* Avatar */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white"
                    style={{ background: 'var(--gradient-primary)' }}>
                    {doc.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{doc.name}</p>
                    <div className="flex items-center gap-1">
                      <IconBadgeCheck size={12} style={{ color: 'var(--color-success)' }} />
                      <span className="text-xs font-semibold" style={{ color: 'var(--color-success)' }}>Verified Doctor</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-2">
                  <span className="badge badge-primary text-xs">{doc.specialization}</span>
                  <span className="badge badge-secondary text-xs">{doc.medical_degree}</span>
                </div>

                {doc.organization && (
                  <p className="text-xs text-muted mb-2 truncate">{doc.organization}</p>
                )}

                <div className="flex items-center justify-between text-xs text-muted mt-3">
                  <span>{doc.years_of_experience} yrs experience</span>
                  <span className="flex items-center gap-1"><IconDoc size={12} /> {doc.published_posts} posts</span>
                </div>

                {doc.languages?.length > 0 && (
                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                    <IconGlobe size={11} style={{ color: 'var(--color-text-secondary)' }} />
                    {doc.languages.slice(0, 3).map(l => (
                      <span key={l} className="text-xs text-muted">{l}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

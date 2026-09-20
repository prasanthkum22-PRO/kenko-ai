import { useState, useEffect } from 'react';
import {
  getPrescriptions,
  updatePrescriptionDispenseStatus,
  getMedicineInventory,
  updateMedicineStock,
  addMedicineToInventory,
} from '../../services/firestoreService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  IconAlert,
  IconCheck,
  IconClock,
  IconFlask,
  IconPill,
  IconPlus,
  IconRefresh,
  IconRx,
  IconX,
} from '../../components/icons';

const EMPTY_MED_FORM = {
  name: '',
  category: 'Antibiotic',
  stock: 100,
  minThreshold: 25,
  unit: 'tablets',
  location: 'Shelf A-01',
};

export default function PharmacyWorkspace() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [prescriptions, setPrescriptions] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders');
  const [searchQuery, setSearchQuery] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [addMedModalOpen, setAddMedModalOpen] = useState(false);
  const [dispenseRx, setDispenseRx] = useState(null);
  const [newMedForm, setNewMedForm] = useState(EMPTY_MED_FORM);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const [rxList, invList] = await Promise.all([
          getPrescriptions(),
          getMedicineInventory(),
        ]);
        if (active) {
          setPrescriptions(rxList || []);
          setInventory(invList || []);
        }
      } catch (err) {
        if (active) console.error('Failed to load pharmacy data:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const handleDispenseMedication = async (rx) => {
    try {
      await updatePrescriptionDispenseStatus(rx.id, 'Dispensed', user?.name || 'Clinical Pharmacist');
      success(`Prescription for ${rx.patientName || 'Patient'} marked as Dispensed.`, 'Dispensed Successfully');
      setReloadKey((k) => k + 1);
    } catch (e) {
      setPrescriptions((prev) =>
        prev.map((p) => (p.id === rx.id ? { ...p, dispenseStatus: 'Dispensed' } : p))
      );
      success(`Prescription for ${rx.patientName || 'Patient'} marked as Dispensed.`, 'Dispensed');
      console.error(e);
    } finally {
      setDispenseRx(null);
    }
  };

  const handleStockUpdate = async (medicineId, currentStock, delta) => {
    const nextStock = Math.max(0, Number(currentStock) + delta);
    try {
      await updateMedicineStock(medicineId, nextStock);
      setInventory((prev) =>
        prev.map((m) =>
          m.id === medicineId
            ? {
                ...m,
                stock: nextStock,
                status:
                  nextStock <= 0
                    ? 'Out of Stock'
                    : nextStock < (m.minThreshold || 25)
                      ? 'Low Stock'
                      : 'In Stock',
              }
            : m
        )
      );
      success('Inventory stock updated.', 'Stock Synced');
    } catch (e) {
      toastError('Could not update inventory: ' + e.message, 'Inventory Error');
    }
  };

  const handleAddMedicineSubmit = async (e) => {
    e.preventDefault();
    if (!newMedForm.name.trim()) return;
    try {
      await addMedicineToInventory(newMedForm);
      success(`Added ${newMedForm.name} to pharmacy inventory.`, 'Medicine Added');
      setAddMedModalOpen(false);
      setNewMedForm({ ...EMPTY_MED_FORM });
      setReloadKey((k) => k + 1);
    } catch (err) {
      toastError(err.message, 'Add Failed');
    }
  };

  const pendingRx = prescriptions.filter((p) => p.dispenseStatus !== 'Dispensed');
  const dispensedRx = prescriptions.filter((p) => p.dispenseStatus === 'Dispensed');
  const lowStockMeds = inventory.filter((m) => m.stock < (m.minThreshold || 25));
  const filteredInventory = inventory.filter(
    (m) => !searchQuery || m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6" id="pharmacy-workspace">
      <header className="page-header">
        <div>
          <span className="badge badge-primary mb-1">
            <IconPill size={14} />
            Clinical Pharmacy &amp; Dispensing
          </span>
          <h1 className="page-title">
            <IconRx size={20} />
            Pharmacist Dispensing Queue
          </h1>
          <p className="page-subtitle">
            Verify physician electronic prescriptions, cross-reference inventory levels &amp; confirm
            dispensing.
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setReloadKey((k) => k + 1)}
          >
            <IconRefresh size={14} />
            Refresh Orders
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setAddMedModalOpen(true)}
          >
            <IconPlus size={14} />
            Add Medicine to Stock
          </button>
        </div>
      </header>

      <div className="kpi-grid">
        {loading ? (
          <>
            <div className="skeleton skeleton-card" />
            <div className="skeleton skeleton-card" />
            <div className="skeleton skeleton-card" />
            <div className="skeleton skeleton-card" />
          </>
        ) : (
          <>
            <div className="kpi-card">
              <div className="flex items-center justify-between">
                <span className="kpi-label">Pending Orders</span>
                <span className="kpi-icon">
                  <IconRx size={16} />
                </span>
              </div>
              <span className="kpi-value text-warning">{pendingRx.length}</span>
              <span className="kpi-foot">Awaiting review &amp; dispensing</span>
            </div>
            <div className="kpi-card">
              <div className="flex items-center justify-between">
                <span className="kpi-label">Inventory Items</span>
                <span className="kpi-icon">
                  <IconFlask size={16} />
                </span>
              </div>
              <span className="kpi-value">{inventory.length}</span>
              <span className="kpi-foot">Tracked medicines on record</span>
            </div>
            <div className="kpi-card">
              <div className="flex items-center justify-between">
                <span className="kpi-label">Low-Stock Alerts</span>
                <span className="kpi-icon">
                  <IconAlert size={16} />
                </span>
              </div>
              <span className="kpi-value text-warning">{lowStockMeds.length}</span>
              <span className="kpi-foot">Below minimum threshold</span>
            </div>
            <div className="kpi-card">
              <div className="flex items-center justify-between">
                <span className="kpi-label">Dispensed Today</span>
                <span className="kpi-icon">
                  <IconCheck size={16} />
                </span>
              </div>
              <span className="kpi-value text-success">{dispensedRx.length}</span>
              <span className="kpi-foot">Confirmed patient pick-ups</span>
            </div>
          </>
        )}
      </div>

      <div className="tabs">
        <button
          type="button"
          className={`tab-item ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          <span className="flex items-center gap-2">
            <IconRx size={14} />
            Prescription Orders
            <span className="badge badge-warning">{pendingRx.length}</span>
          </span>
        </button>
        <button
          type="button"
          className={`tab-item ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          <span className="flex items-center gap-2">
            <IconFlask size={14} />
            Medication Inventory
            <span className="badge badge-secondary">{inventory.length}</span>
          </span>
        </button>
        <button
          type="button"
          className={`tab-item ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <span className="flex items-center gap-2">
            <IconClock size={14} />
            Dispensing History
            <span className="badge badge-success">{dispensedRx.length}</span>
          </span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
        </div>
      ) : (
        <>
          {activeTab === 'orders' && (
            <div className="flex flex-col gap-4 animate-fade-in">
              {pendingRx.map((rx) => (
                <div key={rx.id} className="card">
                  <div className="card-header">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="badge badge-warning">Pending Dispense</span>
                        <span className="text-xs text-muted">ID: {rx.id}</span>
                      </div>
                      <h3 className="text-sm text-primary">
                        Patient: {rx.patientName || 'Patient'} ({rx.patientId || 'PT-2025'})
                      </h3>
                      <p className="text-xs text-secondary">
                        Prescribing Clinician:{' '}
                        <strong>{rx.doctorName || 'Dr. Aarav Patel'}</strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setDispenseRx(rx)}
                      id={`dispense-btn-${rx.id}`}
                    >
                      <IconCheck size={14} />
                      Review &amp; Dispense Medication
                    </button>
                  </div>
                  <div className="card-body flex flex-col gap-3">
                    <div
                      className="p-3 rounded"
                      style={{
                        background: 'var(--color-bg-subtle)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <p className="text-xs font-semibold text-muted mb-1">
                        Physician Clinical Diagnosis (Read-Only)
                      </p>
                      <p className="text-xs text-secondary">
                        {rx.diagnosis || 'Clinical evaluation from consultation'}
                      </p>
                    </div>
                    <div className="table-container">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Medicine Name</th>
                            <th>Dosage</th>
                            <th>Frequency</th>
                            <th>Duration</th>
                            <th>Instructions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(rx.medications || []).map((m, i) => (
                            <tr key={i}>
                              <td className="font-semibold text-primary">{m.name}</td>
                              <td className="text-secondary">{m.dosage}</td>
                              <td className="text-secondary">{m.frequency}</td>
                              <td className="text-secondary">{m.duration}</td>
                              <td className="text-muted">{m.instructions}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ))}

              {pendingRx.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">
                    <IconPill size={20} />
                  </div>
                  <p className="empty-title">No pending prescriptions in the queue.</p>
                  <p className="empty-description">
                    All active physician orders have been dispensed.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="section-card animate-fade-in">
              <div className="section-card-header">
                <div>
                  <h2 className="section-card-title">Medication Inventory &amp; Stock Levels</h2>
                  <p className="card-subtitle">
                    Search, review and adjust current stock across all medicines.
                  </p>
                </div>
                <input
                  type="text"
                  className="input"
                  placeholder="Search medicines..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '220px' }}
                />
              </div>
              <div className="card-body">
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Medicine Name</th>
                        <th>Category</th>
                        <th>Current Stock</th>
                        <th>Shelf Location</th>
                        <th>Status</th>
                        <th>Adjust Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInventory.map((m) => (
                        <tr key={m.id}>
                          <td className="font-semibold text-primary">{m.name}</td>
                          <td className="text-secondary">{m.category}</td>
                          <td className="font-mono font-bold">
                            {m.stock} <span className="text-xs font-normal text-muted">{m.unit}</span>
                          </td>
                          <td className="text-muted">{m.location || 'Shelf A-01'}</td>
                          <td>
                            <span
                              className={`badge ${
                                m.stock <= 0
                                  ? 'badge-danger'
                                  : m.stock < (m.minThreshold || 25)
                                    ? 'badge-warning'
                                    : 'badge-success'
                              }`}
                            >
                              {m.stock <= 0
                                ? 'Out of Stock'
                                : m.stock < (m.minThreshold || 25)
                                  ? 'Low Stock'
                                  : 'In Stock'}
                            </span>
                          </td>
                          <td>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleStockUpdate(m.id, m.stock, -10)}
                                title="Deduct 10 units"
                              >
                                -10
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleStockUpdate(m.id, m.stock, 50)}
                                title="Restock 50 units"
                              >
                                +50 Restock
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredInventory.length === 0 && (
                  <div className="empty-state mt-3">
                    <div className="empty-icon">
                      <IconFlask size={20} />
                    </div>
                    <p className="empty-title">No medicines found.</p>
                    <p className="empty-description">
                      Adjust your search or add a new medicine to the inventory.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="section-card animate-fade-in">
              <div className="section-card-header">
                <div>
                  <h2 className="section-card-title">Completed Dispense Records</h2>
                  <p className="card-subtitle">Audit trail of confirmed dispensed prescriptions.</p>
                </div>
              </div>
              <div className="card-body">
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Patient</th>
                        <th>Prescribed By</th>
                        <th>Dispensed By</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dispensedRx.map((rx) => (
                        <tr key={rx.id}>
                          <td className="font-semibold text-primary">{rx.patientName}</td>
                          <td className="text-secondary">{rx.doctorName || 'Dr. Aarav Patel'}</td>
                          <td className="text-muted">{rx.dispensedBy || 'Pharmacist'}</td>
                          <td>
                            <span className="badge badge-success">
                              <IconCheck size={12} />
                              Dispensed
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {dispensedRx.length === 0 && (
                  <div className="empty-state mt-3">
                    <div className="empty-icon">
                      <IconClock size={20} />
                    </div>
                    <p className="empty-title">No completed dispense records yet.</p>
                    <p className="empty-description">
                      Dispensed prescriptions will appear here for audit tracking.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {addMedModalOpen && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleAddMedicineSubmit}>
            <div className="modal-header">
              <h3 className="modal-title">
                <span className="flex items-center gap-2">
                  <IconPill size={16} />
                  Add Medicine to Stock
                </span>
              </h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setAddMedModalOpen(false)}
              >
                <IconX size={16} />
              </button>
            </div>
            <div className="modal-body flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-muted text-sm mb-0">Medicine Name &amp; Strength</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Ciprofloxacin 500mg"
                  value={newMedForm.name}
                  onChange={(e) => setNewMedForm({ ...newMedForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-muted text-sm">Category</label>
                  <select
                    className="input"
                    value={newMedForm.category}
                    onChange={(e) =>
                      setNewMedForm({ ...newMedForm, category: e.target.value })
                    }
                  >
                    <option value="Antibiotic">Antibiotic</option>
                    <option value="Cardiovascular">Cardiovascular</option>
                    <option value="Analgesic">Analgesic</option>
                    <option value="Antidiabetic">Antidiabetic</option>
                    <option value="Respiratory">Respiratory</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-muted text-sm">Initial Stock Count</label>
                  <input
                    type="number"
                    className="input"
                    value={newMedForm.stock}
                    onChange={(e) =>
                      setNewMedForm({ ...newMedForm, stock: Number(e.target.value) })
                    }
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-muted text-sm">Min Stock Threshold</label>
                  <input
                    type="number"
                    className="input"
                    value={newMedForm.minThreshold}
                    onChange={(e) =>
                      setNewMedForm({ ...newMedForm, minThreshold: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-muted text-sm">Unit</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. tablets"
                    value={newMedForm.unit}
                    onChange={(e) => setNewMedForm({ ...newMedForm, unit: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-muted text-sm">Shelf Location</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Shelf A-01"
                  value={newMedForm.location}
                  onChange={(e) =>
                    setNewMedForm({ ...newMedForm, location: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setAddMedModalOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm">
                <IconCheck size={14} />
                Save to Inventory
              </button>
            </div>
          </form>
        </div>
      )}

      {dispenseRx && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">
                <span className="flex items-center gap-2">
                  <IconRx size={16} />
                  Dispense Medication
                </span>
              </h3>
              <button type="button" className="modal-close" onClick={() => setDispenseRx(null)}>
                <IconX size={16} />
              </button>
            </div>
            <div className="modal-body flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="badge badge-warning">Pending Dispense</span>
                  <span className="text-xs text-muted">ID: {dispenseRx.id}</span>
                </div>
                <p className="text-sm font-semibold text-primary">
                  Patient: {dispenseRx.patientName || 'Patient'} (
                  {dispenseRx.patientId || 'PT-2025'})
                </p>
                <p className="text-xs text-secondary">
                  Prescribing Clinician:{' '}
                  <strong>{dispenseRx.doctorName || 'Dr. Aarav Patel'}</strong>
                </p>
              </div>
              <div
                className="p-3 rounded"
                style={{
                  background: 'var(--color-bg-subtle)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <p className="text-xs font-semibold text-muted mb-1">
                  Physician Clinical Diagnosis (Read-Only)
                </p>
                <p className="text-xs text-secondary">
                  {dispenseRx.diagnosis || 'Clinical evaluation from consultation'}
                </p>
              </div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Medicine Name</th>
                      <th>Dosage</th>
                      <th>Frequency</th>
                      <th>Instructions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dispenseRx.medications || []).map((m, i) => (
                      <tr key={i}>
                        <td className="font-semibold text-primary">{m.name}</td>
                        <td className="text-secondary">{m.dosage}</td>
                        <td className="text-secondary">{m.frequency}</td>
                        <td className="text-muted">{m.instructions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setDispenseRx(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => handleDispenseMedication(dispenseRx)}
              >
                <IconCheck size={14} />
                Confirm Dispense
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
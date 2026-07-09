import React, { useState, useEffect } from 'react';

export default function EquipmentLibrary({ api }) {
  const [equipment, setEquipment] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem,   setEditItem]   = useState(null);
  const [name,        setName]       = useState('');
  const [description, setDescription] = useState('');

  const load = () => api.get('/equipment').then(setEquipment);
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    await api.post('/equipment', { name: name.trim(), description: description.trim() });
    setName(''); setDescription(''); setShowCreate(false);
    load();
  };

  const handleUpdate = async () => {
    await api.put(`/equipment/${editItem.id}`, { name: editItem.name, description: editItem.description });
    setEditItem(null);
    load();
  };

  const handleDelete = async (id, itemName) => {
    if (!window.confirm(`Delete "${itemName}"? This will remove it from all exercises.`)) return;
    await api.del(`/equipment/${id}`);
    load();
  };

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <h1 className="section-title">Equipment <span>Library</span></h1>
          <p className="text-muted text-sm">Manage your equipment and assign it to exercises in the Exercise Library</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setName(''); setDescription(''); setShowCreate(true); }}>
          + Add Equipment
        </button>
      </div>

      {/* Equipment list */}
      <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
        {equipment.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🏋️</div>
            <p>No equipment yet.</p>
          </div>
        )}
        {equipment.map((item, i) => (
          <div key={item.id} style={{
            display:'flex', alignItems:'center', gap:14, padding:'12px 16px',
            background: i%2===0 ? 'var(--bg2)' : 'var(--bg)',
            border:'1px solid var(--border)',
            borderTop: i===0 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:17,
                textTransform:'uppercase', letterSpacing:0.5 }}>
                {item.name}
              </div>
              {item.description && (
                <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{item.description}</div>
              )}
            </div>
            <div style={{ display:'flex', gap:6, flexShrink:0 }}>
              <button className="btn btn-ghost btn-sm"
                onClick={() => setEditItem({ ...item })}>Edit</button>
              <button className="btn btn-danger btn-sm"
                onClick={() => handleDelete(item.id, item.name)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal" style={{ maxWidth:440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add Equipment</div>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Dumbbells" autoFocus
                onKeyDown={e => e.key==='Enter' && handleCreate()} />
            </div>
            <div className="form-group">
              <label className="form-label">Description (optional)</label>
              <input className="form-input" value={description} onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Free weights held in each hand" />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editItem && (
        <div className="modal-backdrop" onClick={() => setEditItem(null)}>
          <div className="modal" style={{ maxWidth:440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">Edit Equipment</div>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-input" value={editItem.name}
                onChange={e => setEditItem({ ...editItem, name:e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" value={editItem.description}
                onChange={e => setEditItem({ ...editItem, description:e.target.value })} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditItem(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleUpdate}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

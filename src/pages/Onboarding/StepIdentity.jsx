import { useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import styles from './Onboarding.module.css';

const COLORS = [
  { hex: '#9C5E4A', name: 'Terracotta' },
  { hex: '#B8955A', name: 'Brass' },
  { hex: '#6B8C72', name: 'Sage' },
  { hex: '#7A6B8C', name: 'Plum' },
  { hex: '#5A7A8C', name: 'Slate' },
  { hex: '#8C6B5A', name: 'Sienna' },
];

export default function StepIdentity({ userId, onDone, partnerAccentToAvoid }) {
  const [name, setName] = useState('');
  const [accent, setAccent] = useState(
    partnerAccentToAvoid === '#9C5E4A' ? '#B8955A' : '#9C5E4A'
  );
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!name.trim() || busy) return;
    if (partnerAccentToAvoid && accent === partnerAccentToAvoid) {
      setError('Pick a different colour than your partner.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let photoUrl = null;
      if (photoFile) {
        const ext = photoFile.name.split('.').pop() || 'jpg';
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(path, photoFile, { upsert: true });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
        photoUrl = pub.publicUrl;
      }

      const { error: insErr } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          name: name.trim(),
          photo_url: photoUrl,
          accent_color: accent,
        });
      if (insErr) throw insErr;

      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.card}>
      <div>
        <div className={styles.stepLabel}>Step 1 of 3</div>
        <div className={styles.title} style={{ marginTop: 6 }}>Who are you?</div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Your name</label>
        <input
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Lauren"
          autoFocus
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Profile photo (optional)</label>
        <div className={styles.avatarRow}>
          <div className={styles.avatar} onClick={() => fileRef.current?.click()}>
            {photoPreview ? <img src={photoPreview} alt="" /> : '+'}
          </div>
          <div className={styles.avatarHint} onClick={() => fileRef.current?.click()}>
            {photoPreview ? 'Change photo' : 'Tap to choose'}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={onFile}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Your accent colour</label>
        <div className={styles.colors}>
          {COLORS.map((c) => (
            <div
              key={c.hex}
              className={`${styles.colorDot} ${accent === c.hex ? styles.on : ''}`}
              style={{ background: c.hex }}
              onClick={() => setAccent(c.hex)}
              title={c.name}
            />
          ))}
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <button
        className={styles.cta}
        disabled={!name.trim() || busy}
        onClick={submit}
      >
        {busy ? '…' : 'Continue →'}
      </button>
    </div>
  );
}

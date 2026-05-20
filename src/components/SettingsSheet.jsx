import { useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { compressImage, extForMime } from '../lib/image';
import styles from './SettingsSheet.module.css';

const COLORS = [
  { hex: '#9C5E4A', name: 'Terracotta' },
  { hex: '#B8955A', name: 'Brass' },
  { hex: '#6B8C72', name: 'Sage' },
  { hex: '#7A6B8C', name: 'Plum' },
  { hex: '#5A7A8C', name: 'Slate' },
  { hex: '#8C6B5A', name: 'Sienna' },
];

export default function SettingsSheet({
  profile,
  partnership,
  partners,
  onProfileUpdated,
  onPartnershipUpdated,
  onClose,
}) {
  const otherPartner = partners.find((p) => p.id !== profile.id);
  const partnerJoined = !!(partnership.partner_a_id && partnership.partner_b_id);

  // Profile fields (dirty-tracked)
  const [name, setName] = useState(profile.name);
  const [accent, setAccent] = useState(profile.accent_color);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(profile.photo_url);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [profileSaved, setProfileSaved] = useState(false);

  // Partnership fields
  const [label, setLabel] = useState(partnership.label);
  const [savingLabel, setSavingLabel] = useState(false);
  const [labelError, setLabelError] = useState(null);
  const [labelSaved, setLabelSaved] = useState(false);

  // Invite link
  const [linkCopied, setLinkCopied] = useState(false);
  const inviteLink = `${window.location.origin}/invite/${partnership.invite_token}`;

  const fileRef = useRef();

  const profileDirty =
    name.trim() !== profile.name ||
    accent !== profile.accent_color ||
    !!photoFile;

  const labelDirty = label.trim() !== partnership.label;

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const saveProfile = async () => {
    if (!profileDirty || savingProfile) return;
    setSavingProfile(true);
    setProfileError(null);
    setProfileSaved(false);
    try {
      let photoUrl = profile.photo_url;
      if (photoFile) {
        const blob = await compressImage(photoFile, 600, 0.85);
        const ext = extForMime(blob.type);
        const path = `${profile.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(path, blob, { contentType: blob.type, upsert: true });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
        photoUrl = pub.publicUrl;
      }
      const { error } = await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          accent_color: accent,
          photo_url: photoUrl,
        })
        .eq('id', profile.id);
      if (error) throw error;
      setPhotoFile(null);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 1800);
      onProfileUpdated();
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const saveLabel = async () => {
    if (!labelDirty || savingLabel) return;
    setSavingLabel(true);
    setLabelError(null);
    setLabelSaved(false);
    try {
      const { error } = await supabase
        .from('partnerships')
        .update({ label: label.trim() })
        .eq('id', partnership.id);
      if (error) throw error;
      setLabelSaved(true);
      setTimeout(() => setLabelSaved(false), 1800);
      onPartnershipUpdated();
    } catch (err) {
      setLabelError(err.message);
    } finally {
      setSavingLabel(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    } catch { /* ignore */ }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.handle} />
        <div className={styles.title}>Settings</div>

        {/* ── PROFILE ───────────────────────────────── */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Your profile</div>

          <div className={styles.avatarRow}>
            <div
              className={styles.avatar}
              onClick={() => fileRef.current?.click()}
              style={{ background: photoPreview ? undefined : accent }}
            >
              {photoPreview
                ? <img src={photoPreview} alt="" />
                : (name[0] || profile.name[0] || '?').toUpperCase()}
            </div>
            <button
              className={styles.avatarHint}
              onClick={() => fileRef.current?.click()}
              type="button"
            >
              {photoPreview ? 'Change photo' : 'Add photo'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={onFile}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Name</label>
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Accent colour</label>
            <div className={styles.colors}>
              {COLORS.map((c) => {
                const isPartnerColor = otherPartner?.accent_color === c.hex;
                return (
                  <div
                    key={c.hex}
                    className={`${styles.colorDot} ${accent === c.hex ? styles.on : ''}`}
                    style={{ background: c.hex }}
                    onClick={() => setAccent(c.hex)}
                    title={isPartnerColor ? `${c.name} (your partner's)` : c.name}
                  >
                    {isPartnerColor && <div className={styles.partnerMark} />}
                  </div>
                );
              })}
            </div>
            {otherPartner && accent === otherPartner.accent_color && (
              <div className={styles.warn}>
                That's also {otherPartner.name}'s colour — you'll be hard to tell apart.
              </div>
            )}
          </div>

          {profileError && <div className={styles.error}>{profileError}</div>}

          <button
            className={styles.save}
            disabled={!profileDirty || savingProfile || !name.trim()}
            onClick={saveProfile}
          >
            {savingProfile ? 'Saving…' : profileSaved ? 'Saved ✓' : 'Save profile'}
          </button>
        </div>

        {/* ── SHARED SPACE ──────────────────────────── */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Shared space</div>

          <div className={styles.field}>
            <label className={styles.label}>Name</label>
            <input
              className={styles.input}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Lauren & Utku"
            />
          </div>

          {labelError && <div className={styles.error}>{labelError}</div>}

          <button
            className={styles.save}
            disabled={!labelDirty || savingLabel || !label.trim()}
            onClick={saveLabel}
          >
            {savingLabel ? 'Saving…' : labelSaved ? 'Saved ✓' : 'Save name'}
          </button>
        </div>

        {/* ── INVITE ────────────────────────────────── */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Invite link</div>
          <div className={styles.inviteBox}>{inviteLink}</div>
          <button className={styles.copyBtn} onClick={copyLink}>
            {linkCopied ? 'Copied ✓' : 'Copy invite link'}
          </button>
          {partnerJoined && (
            <div className={styles.note}>
              Both of you are in — this link still works if you ever need to share it again.
            </div>
          )}
        </div>

        {/* ── SIGN OUT ─────────────────────────────── */}
        <button className={styles.signOut} onClick={signOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}

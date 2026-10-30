import React from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { supabase, publicPhotoUrl, rememberLocalPhoto } from '../supabase';
import { C, R } from '../theme';
import { Icon, T } from '../ui';

/** Shrinks a photo (saves the user's data) and uploads it into the user's own folder. Returns the storage path. */
export async function uploadPhoto(uri, bucket, uid) {
  const small = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1280 } }], {
    compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true,
  });
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from(bucket).upload(path, decode(small.base64), { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(error.message || 'Photo upload failed.');
  rememberLocalPhoto(path, small.uri);
  return path;
}

export async function takeOrPick(source) {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Allow camera access to take photos.');
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    return r.canceled ? null : r.assets[0].uri;
  }
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Allow photo access to attach pictures.');
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
  return r.canceled ? null : r.assets[0].uri;
}

function askSource(cameraOnly) {
  if (cameraOnly) return Promise.resolve('camera');
  return new Promise((resolve) => {
    Alert.alert('Add photo', undefined, [
      { text: 'Take photo', onPress: () => resolve('camera') },
      { text: 'Choose from gallery', onPress: () => resolve('library') },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ], { cancelable: true, onDismiss: () => resolve(null) });
  });
}

/**
 * Row of photo tiles. `items` is [{ uri, path, uploading, key }]; parent owns state.
 * Uploads start as soon as a photo is taken so the final submit is instant.
 */
export default function PhotoPicker({ items, setItems, bucket = 'job-photos', uid, max = 3, cameraOnly = false, label = 'Add photo', onError, tileSize = 96 }) {
  const add = async () => {
    try {
      const src = await askSource(cameraOnly);
      if (!src) return;
      const uri = await takeOrPick(src);
      if (!uri) return;
      const temp = { uri, path: null, uploading: true, key: uri + Date.now() };
      setItems((cur) => [...cur, temp]);
      try {
        const path = await uploadPhoto(uri, bucket, uid);
        setItems((cur) => cur.map((x) => (x.key === temp.key ? { ...x, path, uploading: false } : x)));
      } catch (e) {
        setItems((cur) => cur.filter((x) => x.key !== temp.key));
        throw e;
      }
    } catch (e) {
      onError && onError(e.message);
    }
  };
  const remove = (key) => setItems((cur) => cur.filter((x) => x.key !== key));
  const size = { width: tileSize, height: tileSize };
  return (
    <View style={styles.grid}>
      {items.map((x) => (
        <View key={x.key} style={[styles.tile, size]}>
          <Image source={{ uri: x.uri || publicPhotoUrl(x.path) }} style={styles.img} />
          {x.uploading ? (
            <View style={styles.overlay}><ActivityIndicator color={C.white} /></View>
          ) : (
            <Pressable onPress={() => remove(x.key)} style={styles.remove} accessibilityLabel="Remove photo" hitSlop={8}>
              <Icon name="x" size={13} color={C.white} />
            </Pressable>
          )}
        </View>
      ))}
      {items.length < max ? (
        <Pressable onPress={add} style={[styles.tile, styles.add, size]} accessibilityRole="button" accessibilityLabel={label}>
          <View style={styles.addIcon}><Icon name="camera" size={18} color={C.ink} /></View>
          <T v="tiny" center>{label}</T>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Single document slot used during operator sign-up. */
export function DocSlot({ title, hint, value, onChange, bucket = 'operator-docs', uid, required, cameraOnly, onError }) {
  const [busy, setBusy] = React.useState(false);
  const pick = async () => {
    try {
      const src = await askSource(cameraOnly);
      if (!src) return;
      const uri = await takeOrPick(src);
      if (!uri) return;
      setBusy(true);
      const path = await uploadPhoto(uri, bucket, uid);
      onChange({ uri, path });
    } catch (e) {
      onError && onError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Pressable onPress={pick} style={styles.doc} accessibilityRole="button">
      <View style={styles.docThumb}>
        {busy ? <ActivityIndicator color={C.ink} /> : value ? <Image source={{ uri: value.uri }} style={styles.img} /> : <Icon name="camera" size={18} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="bodyBold">{title}{required ? '' : ' (optional)'}</T>
        <T v="small" muted>{value ? 'Uploaded · tap to replace' : hint}</T>
      </View>
      <View style={[styles.docState, value && { backgroundColor: C.accent, borderColor: C.accent }]}>
        <Icon name={value ? 'check' : 'plus'} size={16} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { borderRadius: R.tile, overflow: 'hidden', backgroundColor: C.white },
  img: { width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,.35)', alignItems: 'center', justifyContent: 'center' },
  remove: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(20,20,20,.75)', alignItems: 'center', justifyContent: 'center' },
  add: { alignItems: 'center', justifyContent: 'center', gap: 6, padding: 6 },
  addIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  doc: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: R.tile, backgroundColor: C.white },
  docThumb: { width: 52, height: 52, borderRadius: 16, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  docState: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
});

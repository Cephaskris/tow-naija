import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, KeyboardAvoidingView, PanResponder, Platform, Pressable, ScrollView,
  StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { C, F, R } from './theme';

/* ---------- Icons ----------
   Thin outline UI icons come from Feather. Vehicle glyphs use "mc:<name>" (Material Community). */
export function Icon({ name, size = 20, color = C.ink, style }) {
  if (name && name.startsWith('mc:')) return <MaterialCommunityIcons name={name.slice(3)} size={size + 2} color={color} style={style} />;
  return <Feather name={name} size={size} color={color} style={style} />;
}

/* ---------- Text ---------- */
const VARIANTS = {
  display: { fontFamily: F.semi, fontSize: 32, lineHeight: 38, letterSpacing: -0.8 },
  h1: { fontFamily: F.semi, fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  h2: { fontFamily: F.semi, fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
  h3: { fontFamily: F.semi, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: F.regular, fontSize: 15, lineHeight: 21 },
  bodyBold: { fontFamily: F.medium, fontSize: 15, lineHeight: 21 },
  value: { fontFamily: F.semi, fontSize: 16, lineHeight: 21 },
  label: { fontFamily: F.medium, fontSize: 13, lineHeight: 18 },
  small: { fontFamily: F.regular, fontSize: 13, lineHeight: 18 },
  tiny: { fontFamily: F.medium, fontSize: 11, lineHeight: 14 },
  price: { fontFamily: F.semi, fontSize: 26, lineHeight: 30, letterSpacing: -0.6 },
};
export function T({ v = 'body', color, muted, center, style, children, ...rest }) {
  return (
    <Text style={[VARIANTS[v], { color: color || (muted ? C.muted : C.ink) }, center && { textAlign: 'center' }, style]} {...rest}>
      {children}
    </Text>
  );
}

/* Big page heading with grey subtitle ("Welcome!" / "Choose any car") */
export function Title({ title, sub, right, style }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, style]}>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="h1">{title}</T>
        {sub ? <T muted>{sub}</T> : null}
      </View>
      {right}
    </View>
  );
}

/* ---------- Buttons ---------- */
const BTN = {
  primary: [C.accent, C.onAccent],
  dark: [C.ink, C.white],
  secondary: [C.white, C.ink],
  soft: [C.soft, C.ink],
  danger: [C.redSoft, C.red],
  ghost: ['transparent', C.ink],
};
export function Btn({ title, onPress, variant = 'primary', loading, disabled, icon, style, small }) {
  const [bg, fg] = BTN[variant] || BTN.primary;
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn, small && styles.btnSmall, { backgroundColor: bg },
        pressed && (variant === 'primary' ? { backgroundColor: C.accentDark } : { opacity: 0.7 }),
        off && { opacity: 0.4 }, style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon ? <Icon name={icon} size={small ? 16 : 18} color={fg} /> : null}
          <Text style={[styles.btnText, small && { fontSize: 14 }, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

/* Round icon button. active → yellow, dark → black. `float` adds a soft shadow for use over maps. */
export function RoundBtn({ name, onPress, label, size = 48, active, dark, float, style, badge }) {
  const bg = active ? C.accent : dark ? C.ink : C.white;
  const fg = dark ? C.white : C.ink;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4}
      style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, float && styles.float, pressed && { opacity: 0.75 }, style]}>
      <Icon name={name} size={Math.round(size * 0.4)} color={fg} />
      {badge ? <View style={styles.badgeDot} /> : null}
    </Pressable>
  );
}
export const IconBtn = RoundBtn;

/* The circular "↗" call-to-action from the reference */
export function ArrowBtn({ onPress, label = 'Open', dark, size = 52, loading, icon = 'arrow-up-right' }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={loading ? undefined : onPress}
      style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, backgroundColor: dark ? C.ink : C.accent, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.8 }]}>
      {loading ? <ActivityIndicator color={dark ? C.white : C.ink} /> : <Icon name={icon} size={Math.round(size * 0.42)} color={dark ? C.white : C.ink} />}
    </Pressable>
  );
}

/* White pill holding round toggles; the selected one turns yellow */
export function Segmented({ options, value, onChange, size = 40 }) {
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={o.label}
            style={[{ height: size, minWidth: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: o.text ? 14 : 0, flexDirection: 'row', gap: 6 }, on && { backgroundColor: C.accent }]}>
            {o.icon ? <Icon name={o.icon} size={18} color={on ? C.ink : C.muted} /> : null}
            {o.text ? <Text style={{ fontFamily: F.semi, fontSize: 13, color: on ? C.ink : C.muted }}>{o.text}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/* Outlined pill badge, e.g. "◎ 516 m" */
export function Badge({ icon, text, style, dark }) {
  return (
    <View style={[styles.pillBadge, dark && { backgroundColor: 'rgba(20,20,20,0.55)', borderColor: 'transparent' }, style]}>
      {icon ? <Icon name={icon} size={14} color={dark ? C.white : C.ink} /> : null}
      <Text style={{ fontFamily: F.medium, fontSize: 13, color: dark ? C.white : C.ink }}>{text}</Text>
    </View>
  );
}

/* Stat tile: outlined icon circle, grey label, bold value (Cost / Seats / Power in the reference) */
export function Tile({ icon, label, value, style, tone }) {
  return (
    <View style={[styles.tile, tone === 'soft' && { backgroundColor: C.soft }, style]}>
      <View style={styles.tileIcon}>
        {typeof icon === 'string' && icon.length <= 2 && !icon.includes('-') ? <Text style={{ fontFamily: F.semi, fontSize: 13, color: C.ink }}>{icon}</Text> : <Icon name={icon} size={15} />}
      </View>
      <T v="small" muted numberOfLines={1}>{label}</T>
      <T v="value" numberOfLines={1}>{value}</T>
    </View>
  );
}
export function TileRow({ children, scroll }) {
  if (scroll) return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>{children}</ScrollView>;
  return <View style={{ flexDirection: 'row', gap: 10 }}>{children}</View>;
}

/* ---------- Slide to confirm: yellow knob, › › › track, ghost end circle ---------- */
export function SlideToConfirm({ label, onConfirm, icon = 'mc:tow-truck', endIcon = 'check', loading, disabled, dark }) {
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const knob = 56;
  const max = Math.max(0, w - knob - 8);
  const maxRef = useRef(0);
  maxRef.current = max;
  const cb = useRef(onConfirm);
  cb.current = onConfirm;
  const blocked = useRef(false);
  blocked.current = !!(loading || disabled);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !blocked.current,
    onMoveShouldSetPanResponder: (_, g) => !blocked.current && Math.abs(g.dx) > 4,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => x.setValue(Math.max(0, Math.min(maxRef.current, g.dx))),
    onPanResponderRelease: (_, g) => {
      if (g.dx > maxRef.current * 0.82) {
        Animated.timing(x, { toValue: maxRef.current, duration: 120, useNativeDriver: false }).start(() => {
          Promise.resolve(cb.current && cb.current()).finally(() => Animated.spring(x, { toValue: 0, useNativeDriver: false }).start());
        });
      } else {
        Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
      }
    },
  })).current;

  const fillW = x.interpolate({ inputRange: [0, Math.max(1, max)], outputRange: [knob + 8, Math.max(knob + 8, w)], extrapolate: 'clamp' });
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[styles.slider, dark && { backgroundColor: C.ink }, disabled && { opacity: 0.45 }]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityHint="Double tap to confirm"
      accessibilityActions={[{ name: 'activate', label }]}
      onAccessibilityAction={() => !blocked.current && cb.current && cb.current()}
    >
      <Animated.View style={[styles.sliderFill, { width: fillW }]} />
      <View style={styles.sliderLabel} pointerEvents="none">
        <Text style={[styles.sliderText, dark && { color: C.white }]} numberOfLines={1}>{label}</Text>
        <Icon name="chevrons-right" size={16} color={dark ? '#7A7A7A' : C.faint} />
      </View>
      <View style={[styles.sliderEnd, dark && { borderColor: '#3A3A3A' }]} pointerEvents="none">
        <Icon name={endIcon} size={18} color={dark ? '#7A7A7A' : C.faint} />
      </View>
      <Animated.View {...pan.panHandlers} style={[styles.sliderKnob, { transform: [{ translateX: x }] }]}>
        {loading ? <ActivityIndicator color={C.ink} /> : <Icon name={icon} size={20} color={C.ink} />}
      </Animated.View>
    </View>
  );
}

/* ---------- Inputs ---------- */
export function Field({ label, hint, error, style, inputStyle, icon, soft, ...props }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ gap: 8 }, style]}>
      {label ? <T v="label">{label}</T> : null}
      <View style={[styles.inputWrap, soft && { backgroundColor: C.soft, borderColor: C.soft }, focus && { borderColor: C.ink }, error && { borderColor: C.red }]}>
        {icon ? <Icon name={icon} size={18} color={C.muted} /> : null}
        <TextInput
          placeholderTextColor={C.faint}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={[styles.input, inputStyle]}
          {...props}
        />
      </View>
      {error ? <T v="small" color={C.red}>{error}</T> : hint ? <T v="small" muted>{hint}</T> : null}
    </View>
  );
}

export function ToggleRow({ label, hint, value, onValueChange, icon }) {
  return (
    <Pressable onPress={() => onValueChange(!value)} style={styles.toggleRow} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      {icon ? <View style={styles.tileIcon}><Icon name={icon} size={15} /></View> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <T v="bodyBold">{label}</T>
        {hint ? <T v="small" muted>{hint}</T> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: C.ink, false: C.line }} thumbColor={value ? C.accent : C.white} />
    </Pressable>
  );
}

/* Choice pills (single select); selected = yellow */
export function Choices({ options, value, onChange }) {
  return (
    <View style={styles.choices}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)} accessibilityRole="radio" accessibilityState={{ selected: on }}
            style={[styles.choice, on && styles.choiceOn]}>
            {o.icon ? <Icon name={o.icon} size={16} color={C.ink} /> : null}
            <Text style={styles.choiceText}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* Big square option tiles (vehicle type etc.) */
export function OptionTiles({ options, value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="radio" accessibilityState={{ selected: on }}
            style={[styles.optTile, on && { backgroundColor: C.accent }]}>
            <Icon name={o.icon} size={24} color={C.ink} />
            <T v="label">{o.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------- Layout ---------- */
export function Screen({ children, scroll = true, footer, style, padded = true, bg = C.bg, bottomSpace = 24 }) {
  const ins = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[padded && styles.pad, { paddingBottom: bottomSpace }, style]}>
      {children}
    </ScrollView>
  ) : <View style={[{ flex: 1 }, padded && styles.pad, style]}>{children}</View>;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: bg, paddingTop: ins.top }}>
      {body}
      {footer ? <View style={[styles.footer, { paddingBottom: 12 + ins.bottom }]}>{footer}</View> : <View style={{ height: ins.bottom }} />}
    </KeyboardAvoidingView>
  );
}

/* Top row of round buttons: back on the left, optional middle and right controls */
export function TopBar({ onBack, left, middle, right, title, sub }) {
  return (
    <View style={{ gap: 14, paddingTop: 8, paddingBottom: 6 }}>
      <View style={styles.topRow}>
        {left || (onBack ? <RoundBtn name="arrow-left" label="Back" onPress={onBack} /> : <View style={{ width: 48 }} />)}
        <View style={{ flex: 1, alignItems: 'center' }}>{middle}</View>
        {right || <View style={{ width: 48 }} />}
      </View>
      {title ? <Title title={title} sub={sub} /> : null}
    </View>
  );
}

export const Gap = ({ h = 16 }) => <View style={{ height: h }} />;
export const Divider = ({ style }) => <View style={[{ height: 1, backgroundColor: C.line }, style]} />;

export function Card({ children, style, onPress, tone }) {
  const bg = { green: C.greenSoft, amber: C.amberSoft, red: C.redSoft, soft: C.soft, fill: C.soft, accent: C.accent, dark: C.ink }[tone] || C.white;
  const base = [styles.card, { backgroundColor: bg }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.88 }]}>{children}</Pressable>;
}

export function Chip({ label, tone = 'fill', icon }) {
  const map = { green: [C.greenSoft, C.green], amber: [C.amberSoft, C.amber], red: [C.redSoft, C.red], blue: [C.blueSoft, C.blue], fill: [C.soft, C.muted], accent: [C.accent, C.ink], dark: [C.ink, C.white] };
  const [bg, fg] = map[tone] || map.fill;
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      {icon ? <Icon name={icon} size={12} color={fg} /> : null}
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function Row({ children, style, gap = 12 }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function KV({ k, v, bold }) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 7 }}>
      <T muted>{k}</T>
      <T v={bold ? 'value' : 'bodyBold'} style={{ flexShrink: 1, textAlign: 'right' }}>{v}</T>
    </Row>
  );
}

export function Stars({ value = 0, onChange, size = 34 }) {
  return (
    <Row gap={8} style={{ justifyContent: 'center' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange && onChange(n)} accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`} hitSlop={6}
          style={{ width: size + 14, height: size + 14, borderRadius: (size + 14) / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: n <= value ? C.accent : C.soft }}>
          <Icon name="star" size={size * 0.6} color={n <= value ? C.ink : C.faint} />
        </Pressable>
      ))}
    </Row>
  );
}

export function RatingText({ avg, count, color }) {
  if (!count) return <T v="small" color={color} muted={!color}>New on Townaija</T>;
  return <T v="small" color={color} muted={!color}>★ {Number(avg).toFixed(1)} · {count} rating{count > 1 ? 's' : ''}</T>;
}

export function Avatar({ name, size = 48, tone }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tone === 'accent' ? C.accent : C.soft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: F.semi, fontSize: size * 0.38, color: C.ink }}>{String(name || '?').trim().slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

export function Loading({ text }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: C.bg }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.ink} />
      </View>
      {text ? <T muted>{text}</T> : null}
    </View>
  );
}

export function Empty({ icon = 'inbox', title, text, action }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, gap: 10, paddingHorizontal: 16 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={24} color={C.muted} />
      </View>
      <T v="h3" center>{title}</T>
      {text ? <T muted center>{text}</T> : null}
      {action}
    </View>
  );
}

export function Pulse({ size = 14, color = C.accent }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: 1400, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [a]);
  return (
    <View style={{ width: size * 3, height: size * 3, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: size * 3, height: size * 3, borderRadius: size * 1.5, backgroundColor: color, opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }), transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.ink, borderWidth: 3, borderColor: color }} />
    </View>
  );
}

/* Rounded white card that sits over a map (the "Audi RS6" card in the reference) */
export function Sheet({ children, style }) {
  const ins = useSafeAreaInsets();
  return (
    <View style={[styles.sheet, { paddingBottom: 18 + ins.bottom }, style]}>
      <View style={styles.grabber} />
      {children}
    </View>
  );
}

/* Floating pill tab bar with yellow active circle */
export function TabBar({ items, active, onChange }) {
  const ins = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.tabWrap, { bottom: 14 + ins.bottom }]}>
      <View style={styles.tabBar}>
        {items.map((it) => {
          const on = it.key === active;
          return (
            <Pressable key={it.key} onPress={() => !on && onChange(it.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={it.label}
              style={[styles.tabItem, on && { backgroundColor: C.accent }]}>
              <Icon name={it.icon} size={21} color={on ? C.ink : C.faint} />
              {it.badge ? <View style={styles.badgeDot} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
export const TAB_SPACE = 110;

/* Page dots under a carousel */
export function Dots({ count, index }) {
  return (
    <Row gap={6} style={{ justifyContent: 'center' }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: i === index ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? C.ink : C.faint }} />
      ))}
    </Row>
  );
}

/* ---------- Toasts ---------- */
const ToastCtx = createContext({ show: () => {} });
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const timer = useRef();
  const ins = useSafeAreaInsets();
  const show = useCallback((text, kind = 'ok') => {
    clearTimeout(timer.current);
    setMsg({ text, kind });
    timer.current = setTimeout(() => setMsg(null), kind === 'error' ? 4500 : 2800);
  }, []);
  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      {msg ? (
        <Pressable onPress={() => setMsg(null)} style={[styles.toast, { top: ins.top + 10 }]}>
          <View style={[styles.toastIcon, msg.kind === 'error' && { backgroundColor: C.red }]}>
            <Icon name={msg.kind === 'error' ? 'alert-circle' : 'check'} size={16} color={msg.kind === 'error' ? C.white : C.ink} />
          </View>
          <Text style={styles.toastText}>{msg.text}</Text>
        </Pressable>
      ) : null}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 18, paddingTop: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  float: { elevation: 5, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  btn: { minHeight: 56, borderRadius: R.pill, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnSmall: { minHeight: 44, paddingHorizontal: 16 },
  btnText: { fontFamily: F.semi, fontSize: 16 },
  segment: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: C.white, borderRadius: R.pill, padding: 4 },
  pillBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: R.pill, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, alignSelf: 'flex-start' },
  tile: { backgroundColor: C.white, borderRadius: R.tile, padding: 14, gap: 6, minWidth: 104, flex: 1 },
  tileIcon: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  slider: { height: 64, borderRadius: R.pill, backgroundColor: C.soft, justifyContent: 'center', overflow: 'hidden' },
  sliderFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: R.pill, backgroundColor: 'rgba(245,239,58,0.35)' },
  sliderLabel: { position: 'absolute', left: 72, right: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  sliderText: { fontFamily: F.semi, fontSize: 15, color: C.ink },
  sliderEnd: { position: 'absolute', right: 4, width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  sliderKnob: { position: 'absolute', left: 4, width: 56, height: 56, borderRadius: 28, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, borderRadius: R.input, backgroundColor: C.white, paddingHorizontal: 16, borderWidth: 1.5, borderColor: C.white },
  input: { flex: 1, fontFamily: F.regular, fontSize: 16, color: C.ink, paddingVertical: 14 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, height: 42, borderRadius: R.pill, backgroundColor: C.white },
  choiceOn: { backgroundColor: C.accent },
  choiceText: { fontFamily: F.medium, fontSize: 14, color: C.ink },
  optTile: { width: '48%', flexGrow: 1, backgroundColor: C.white, borderRadius: R.tile, paddingVertical: 18, paddingHorizontal: 16, gap: 10 },
  footer: { paddingHorizontal: 18, paddingTop: 12, backgroundColor: C.bg, gap: 10 },
  card: { borderRadius: R.card, padding: 18, gap: 10 },
  chip: { flexDirection: 'row', gap: 4, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.pill, alignSelf: 'flex-start' },
  chipText: { fontFamily: F.semi, fontSize: 11 },
  sheet: { position: 'absolute', left: 10, right: 10, bottom: 10, backgroundColor: C.white, borderRadius: 32, paddingHorizontal: 18, paddingTop: 10, gap: 14, elevation: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: -2 } },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 2 },
  tabWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  tabBar: { flexDirection: 'row', gap: 10, backgroundColor: C.white, borderRadius: R.pill, padding: 6, elevation: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
  tabItem: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  badgeDot: { position: 'absolute', top: 10, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: C.red, borderWidth: 1.5, borderColor: C.white },
  toast: { position: 'absolute', left: 14, right: 14, backgroundColor: C.ink, borderRadius: 22, padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center', elevation: 20, zIndex: 100 },
  toastIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  toastText: { color: C.white, fontFamily: F.medium, fontSize: 14, flex: 1 },
});

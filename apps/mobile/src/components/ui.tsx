import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme, type ThemePalette } from '../context/ThemeContext';

/* ------------------------------------------------------------------ */
/* Gradient                                                            */
/* ------------------------------------------------------------------ */

/**
 * Gradient fill drawn with react-native-svg so the app avoids taking on a
 * native gradient dependency. Sizes itself to the parent via onLayout.
 */
export function GradientFill({
  colors,
  style,
  borderRadius = 0,
}: {
  colors: readonly [string, string];
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const gradientId = useMemo(() => `grad-${Math.random().toString(36).slice(2, 9)}`, []);

  return (
    <View
      style={[StyleSheet.absoluteFill, { borderRadius, overflow: 'hidden' }, style]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
      }}
      pointerEvents="none"
    >
      {size.width > 0 && size.height > 0 ? (
        <Svg width={size.width} height={size.height}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors[0]} />
              <Stop offset="1" stopColor={colors[1]} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={size.width} height={size.height} fill={`url(#${gradientId})`} />
        </Svg>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const inert = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inert }}
      style={({ pressed }) => [
        styles.primaryButton,
        inert && styles.primaryButtonDisabled,
        pressed && !inert && styles.primaryButtonPressed,
      ]}
      onPress={onPress}
      disabled={inert}
    >
      {!inert ? <GradientFill colors={palette.gradient} borderRadius={radiusLg} /> : null}
      <View style={styles.primaryButtonInner}>
        <Text style={[styles.primaryButtonText, inert && styles.primaryButtonTextDisabled]}>
          {loading ? 'Please wait…' : label}
        </Text>
        {icon && !inert ? <Ionicons name={icon} size={18} color="#FFFFFF" /> : null}
      </View>
    </Pressable>
  );
}

export function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <Pressable accessibilityRole="button" style={styles.textButton} onPress={onPress} hitSlop={8}>
      <Text style={styles.textButtonLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={15} color={palette.primary} />
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Step scaffold                                                       */
/* ------------------------------------------------------------------ */

/**
 * Shared chrome for every signup step: back affordance, step progress,
 * scrolling body, and a sticky footer.
 */
/*
 * Keeps the focused field above the keyboard.
 *
 * Android does not scroll a focused TextInput into view on its own, and
 * automaticallyAdjustKeyboardInsets is iOS-only, so on Android the keyboard
 * simply drew over the field being typed into. Inputs report their focus here
 * and the scroll container moves them into the visible strip above the
 * keyboard.
 */
interface KeyboardScrollValue {
  onInputFocus: (node: View | null) => void;
}

const KeyboardScrollContext = createContext<KeyboardScrollValue | null>(null);

/**
 * Where the keyboard is, 0 when closed.
 *
 * `screenY` is the Y coordinate of its top edge, which is what decides whether
 * a field is covered. Deriving that from the screen height instead was off by
 * the system bars — enough to conclude a hidden field was visible.
 */
export function useKeyboard() {
  const [keyboard, setKeyboard] = useState({ height: 0, screenY: 0 });

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) =>
      setKeyboard({
        height: event.endCoordinates?.height ?? 0,
        screenY: event.endCoordinates?.screenY ?? 0,
      })
    );
    const hide = Keyboard.addListener(hideEvent, () => setKeyboard({ height: 0, screenY: 0 }));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return keyboard;
}

/**
 * Lets a screen with its own ScrollView behave like the signup steps.
 *
 * Wrap the scroll view's children in the provider and give it the handlers
 * this returns; any Input inside will then be scrolled clear of the keyboard.
 */
export function useKeyboardAwareScroll() {
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const focusedInput = useRef<View | null>(null);
  const keyboard = useKeyboard();

  const reveal = useCallback((keyboardTop: number) => {
    const node = focusedInput.current;
    if (!node || keyboardTop <= 0) return;

    node.measureInWindow((_x, y, _width, height) => {
      const margin = 72;
      const visibleBottom = keyboardTop - margin;
      const inputBottom = y + height;
      if (inputBottom <= visibleBottom) return;

      scrollRef.current?.scrollTo({
        y: Math.max(scrollY.current + (inputBottom - visibleBottom), 0),
        animated: true,
      });
    });
  }, []);

  useEffect(() => {
    reveal(keyboard.screenY);
  }, [keyboard.screenY, reveal]);

  const onInputFocus = useCallback(
    (node: View | null) => {
      focusedInput.current = node;
      reveal(keyboard.screenY);
    },
    [keyboard.screenY, reveal]
  );

  const contextValue = useMemo(() => ({ onInputFocus }), [onInputFocus]);

  return {
    scrollRef,
    contextValue,
    keyboardHeight: keyboard.height,
    scrollProps: {
      ref: scrollRef,
      onScroll: (event: { nativeEvent: { contentOffset: { y: number } } }) => {
        scrollY.current = event.nativeEvent.contentOffset.y;
      },
      scrollEventThrottle: 16,
      keyboardShouldPersistTaps: 'handled' as const,
    },
  };
}

export { KeyboardScrollContext };

export function StepScaffold({
  onBack,
  step,
  totalSteps,
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  onBack?: () => void;
  step?: number;
  totalSteps?: number;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const showProgress = typeof step === 'number' && typeof totalSteps === 'number' && totalSteps > 0;

  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const focusedInput = useRef<View | null>(null);
  const keyboard = useKeyboard();
  const keyboardHeight = keyboard.height;

  /*
   * Scroll the focused field clear of the keyboard.
   *
   * Measured in window coordinates rather than with measureLayout, which in
   * this React Native version requires a ref to a host component and rejects
   * the scroll view's inner node.
   */
  const revealFocusedInput = useCallback((keyboardTop: number) => {
    const node = focusedInput.current;
    if (!node || keyboardTop <= 0) return;

    node.measureInWindow((_x, y, _width, height) => {
      // Leave more than a hairline above the keyboard, so the field and its
      // label are both readable rather than flush against it.
      const margin = 72;
      const visibleBottom = keyboardTop - margin;
      const inputBottom = y + height;
      if (inputBottom <= visibleBottom) return;

      scrollRef.current?.scrollTo({
        y: Math.max(scrollY.current + (inputBottom - visibleBottom), 0),
        animated: true,
      });
    });
  }, []);

  // The keyboard height is not known at focus time, so the scroll waits until
  // it is — and runs again if the keyboard resizes, as it does when the
  // suggestion strip appears.
  useEffect(() => {
    revealFocusedInput(keyboard.screenY);
  }, [keyboard.screenY, revealFocusedInput]);

  const onInputFocus = useCallback(
    (node: View | null) => {
      focusedInput.current = node;
      revealFocusedInput(keyboard.screenY);
    },
    [keyboard.screenY, revealFocusedInput]
  );

  const keyboardScroll = useMemo(() => ({ onInputFocus }), [onInputFocus]);

  return (
    /*
     * Lift the content above the on-screen keyboard.
     *
     * Nothing did this before, so on the signup steps the keyboard covered the
     * very field being typed into — you could not see what you had entered.
     * iOS needs an explicit behaviour; Android resizes the window itself
     * (softwareKeyboardLayoutMode "resize" in app.json), and adding padding on
     * top of that would double-count the inset.
     */
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        {onBack ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" style={styles.iconButton} onPress={onBack} hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color={palette.text} />
          </Pressable>
        ) : (
          <View style={styles.iconButton} />
        )}

        {showProgress ? (
          <View style={styles.progressTrack}>
            {Array.from({ length: totalSteps! }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressSegment,
                  index < step! && styles.progressSegmentDone,
                  index === step! - 1 && styles.progressSegmentActive,
                ]}
              />
            ))}
          </View>
        ) : (
          <View style={styles.progressTrack} />
        )}

        {showProgress ? (
          <View style={styles.iconButton}>
            <Text style={styles.stepCount}>
              {step}/{totalSteps}
            </Text>
          </View>
        ) : (
          <View style={styles.iconButtonSpacer} />
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        onScroll={(event) => {
          scrollY.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        style={styles.body}
        contentContainerStyle={[
          styles.bodyInner,
          // Room to scroll the last field clear of the keyboard.
          keyboardHeight > 0 && { paddingBottom: keyboardHeight + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        // Scrolls the focused field into view instead of leaving it behind the
        // keyboard. iOS-only; Android gets the same effect from resizing.
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <KeyboardScrollContext.Provider value={keyboardScroll}>
          <View style={styles.content}>{children}</View>
        </KeyboardScrollContext.Provider>
      </ScrollView>

      {footer && keyboardHeight === 0 ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>{footer}</View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      {children}
      {error ? (
        <Text style={styles.fieldError}>{error}</Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Input({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  multiline,
  maxLength,
  prefix,
  invalid,
  onBlur,
}: {
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  autoCapitalize?: 'none' | 'words' | 'sentences';
  multiline?: boolean;
  maxLength?: number;
  prefix?: React.ReactNode;
  invalid?: boolean;
  onBlur?: () => void;
}) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [focused, setFocused] = useState(false);
  const shellRef = useRef<View>(null);
  const keyboardScroll = useContext(KeyboardScrollContext);

  return (
    <View
      ref={shellRef}
      style={[
        styles.inputShell,
        multiline && styles.inputShellMultiline,
        focused && styles.inputShellFocused,
        invalid && styles.inputShellInvalid,
      ]}
    >
      {prefix ? <View style={styles.inputPrefix}>{prefix}</View> : null}
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.muted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        maxLength={maxLength}
        onFocus={() => {
          setFocused(true);
          keyboardScroll?.onInputFocus(shellRef.current);
        }}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

/** Select control that opens a searchable bottom sheet of options. */
export function Select({
  value,
  placeholder,
  options,
  onChange,
  disabled,
  searchable = true,
  title,
}: {
  value: string | null;
  placeholder: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
  disabled?: boolean;
  searchable?: boolean;
  title?: string;
}) {
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((option) => option.id === value) || null;
  const filtered = query.trim()
    ? options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        style={[styles.inputShell, styles.selectShell, disabled && styles.selectDisabled]}
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
      >
        <Text style={[styles.selectValue, !selected && styles.selectPlaceholder]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={disabled ? palette.muted : palette.textSoft} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.sheetGrabber} />
          <Text style={styles.sheetTitle}>{title || placeholder}</Text>

          {searchable && options.length > 8 ? (
            <View style={styles.sheetSearch}>
              <Ionicons name="search" size={16} color={palette.muted} />
              <TextInput
                style={styles.sheetSearchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search"
                placeholderTextColor={palette.muted}
                autoCorrect={false}
              />
            </View>
          ) : null}

          <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled">
            {filtered.map((option) => {
              const isActive = option.id === value;
              return (
                <Pressable
                  key={option.id}
                  style={[styles.sheetOption, isActive && styles.sheetOptionActive]}
                  onPress={() => {
                    onChange(option.id);
                    setQuery('');
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.sheetOptionLabel, isActive && styles.sheetOptionLabelActive]}>
                    {option.label}
                  </Text>
                  {isActive ? <Ionicons name="checkmark-circle" size={20} color={palette.primary} /> : null}
                </Pressable>
              );
            })}
            {filtered.length === 0 ? <Text style={styles.sheetEmpty}>No matches</Text> : null}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Choice chips                                                        */
/* ------------------------------------------------------------------ */

export function Chip({
  label,
  selected,
  onPress,
  icon,
  style,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipSelected, style]}
      onPress={onPress}
    >
      {icon ? (
        <Ionicons name={icon} size={16} color={selected ? palette.primary : palette.muted} />
      ) : null}
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
      {selected ? <Ionicons name="checkmark" size={14} color={palette.primary} /> : null}
    </Pressable>
  );
}

export function ChipGroup({ children }: { children: React.ReactNode }) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  return <View style={styles.chipGroup}>{children}</View>;
}

/** Large two/three-up selectable card, used for gender and eating habits. */
export function OptionCard({
  label,
  caption,
  icon,
  selected,
  onPress,
}: {
  label: string;
  caption?: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
}) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.optionCard, selected && styles.optionCardSelected]}
      onPress={onPress}
    >
      <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
        <Ionicons name={icon} size={22} color={selected ? '#FFFFFF' : palette.primary} />
      </View>
      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
      {caption ? <Text style={styles.optionCaption}>{caption}</Text> : null}
    </Pressable>
  );
}

export function Checkbox({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
}) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={styles.checkboxRow}
      onPress={onPress}
    >
      <View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>
        {checked ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </Pressable>
  );
}

/** Informational callout, e.g. the computed age readout. */
export function Callout({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <View style={styles.callout}>
      <Ionicons name={icon} size={16} color={palette.accent} />
      <Text style={styles.calloutText}>{text}</Text>
    </View>
  );
}

export function SectionHeading({ title, caption }: { title: string; caption?: string }) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}
    </View>
  );
}

export function SegmentedTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.segmentRow}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            style={[styles.segment, isActive && styles.segmentActive]}
            onPress={() => onChange(tab.id)}
          >
            <Text style={[styles.segmentLabel, isActive && styles.segmentLabelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const radiusLg = 18;

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: palette.bg,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.surface,
    },
    iconButtonSpacer: {
      width: 40,
      height: 40,
    },
    progressTrack: {
      flex: 1,
      flexDirection: 'row',
      gap: 4,
      alignItems: 'center',
    },
    progressSegment: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: palette.border,
    },
    progressSegmentDone: {
      backgroundColor: palette.primary,
    },
    progressSegmentActive: {
      backgroundColor: palette.violet,
    },
    stepCount: {
      fontSize: 12,
      fontWeight: '700',
      color: palette.muted,
    },
    body: {
      flex: 1,
    },
    bodyInner: {
      paddingHorizontal: 22,
      paddingTop: 10,
      paddingBottom: 32,
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      color: palette.primary,
      marginBottom: 8,
    },
    title: {
      fontSize: 27,
      fontWeight: '800',
      letterSpacing: -0.5,
      color: palette.text,
      lineHeight: 33,
    },
    subtitle: {
      fontSize: 14.5,
      color: palette.muted,
      marginTop: 8,
      lineHeight: 21,
    },
    content: {
      marginTop: 26,
      gap: 20,
    },
    footer: {
      paddingHorizontal: 22,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: palette.border,
      backgroundColor: palette.surface,
      gap: 10,
    },

    primaryButton: {
      borderRadius: radiusLg,
      overflow: 'hidden',
      backgroundColor: palette.primary,
      shadowColor: palette.primaryDeep,
      shadowOpacity: 0.3,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 5,
    },
    primaryButtonPressed: {
      opacity: 0.9,
    },
    primaryButtonDisabled: {
      backgroundColor: palette.surfaceSunken,
      shadowOpacity: 0,
      elevation: 0,
    },
    primaryButtonInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 17,
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
    primaryButtonTextDisabled: {
      color: palette.muted,
    },
    textButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 12,
    },
    textButtonLabel: {
      color: palette.primary,
      fontSize: 14.5,
      fontWeight: '700',
    },

    field: {
      gap: 8,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.2,
      color: palette.textSoft,
    },
    fieldHint: {
      fontSize: 12.5,
      color: palette.muted,
    },
    fieldError: {
      fontSize: 12.5,
      color: palette.danger,
      fontWeight: '600',
    },

    inputShell: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.surface,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: palette.border,
      paddingHorizontal: 16,
      minHeight: 56,
    },
    inputShellMultiline: {
      alignItems: 'flex-start',
      paddingVertical: 14,
      minHeight: 120,
    },
    inputShellFocused: {
      borderColor: palette.primary,
      backgroundColor: palette.surface,
    },
    inputShellInvalid: {
      borderColor: palette.danger,
    },
    inputPrefix: {
      marginRight: 10,
      flexDirection: 'row',
      alignItems: 'center',
    },
    input: {
      flex: 1,
      fontSize: 15.5,
      color: palette.text,
      paddingVertical: Platform.OS === 'ios' ? 16 : 12,
    },
    inputMultiline: {
      paddingVertical: 0,
      minHeight: 92,
    },

    selectShell: {
      justifyContent: 'space-between',
    },
    selectDisabled: {
      backgroundColor: palette.surfaceSunken,
      borderColor: palette.border,
    },
    selectValue: {
      flex: 1,
      fontSize: 15.5,
      color: palette.text,
      fontWeight: '600',
      marginRight: 10,
    },
    selectPlaceholder: {
      color: palette.muted,
      fontWeight: '400',
    },

    sheetBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(8,9,20,0.45)',
    },
    sheet: {
      backgroundColor: palette.surface,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      paddingHorizontal: 20,
      paddingTop: 10,
      maxHeight: '76%',
    },
    sheetGrabber: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: palette.borderStrong,
      marginBottom: 14,
    },
    sheetTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: palette.text,
      marginBottom: 14,
    },
    sheetSearch: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: palette.surfaceSunken,
      borderRadius: 14,
      paddingHorizontal: 14,
      marginBottom: 10,
    },
    sheetSearchInput: {
      flex: 1,
      fontSize: 15,
      color: palette.text,
      paddingVertical: 12,
    },
    sheetList: {
      marginBottom: 8,
    },
    sheetOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 15,
      paddingHorizontal: 14,
      borderRadius: 14,
    },
    sheetOptionActive: {
      backgroundColor: palette.primarySoft,
    },
    sheetOptionLabel: {
      fontSize: 15.5,
      color: palette.textSoft,
    },
    sheetOptionLabelActive: {
      color: palette.primary,
      fontWeight: '700',
    },
    sheetEmpty: {
      textAlign: 'center',
      color: palette.muted,
      paddingVertical: 24,
    },

    chipGroup: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: palette.border,
      backgroundColor: palette.surface,
    },
    chipSelected: {
      borderColor: palette.primary,
      backgroundColor: palette.primarySoft,
    },
    chipLabel: {
      fontSize: 14.5,
      fontWeight: '600',
      color: palette.textSoft,
    },
    chipLabelSelected: {
      color: palette.primary,
      fontWeight: '700',
    },

    optionCard: {
      flex: 1,
      minWidth: 100,
      alignItems: 'center',
      gap: 8,
      paddingVertical: 20,
      paddingHorizontal: 12,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: palette.border,
      backgroundColor: palette.surface,
    },
    optionCardSelected: {
      borderColor: palette.primary,
      backgroundColor: palette.primarySoft,
    },
    optionIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.primarySoft,
    },
    optionIconSelected: {
      backgroundColor: palette.primary,
    },
    optionLabel: {
      fontSize: 14.5,
      fontWeight: '700',
      color: palette.textSoft,
      textAlign: 'center',
    },
    optionLabelSelected: {
      color: palette.primary,
    },
    optionCaption: {
      fontSize: 12,
      color: palette.muted,
      textAlign: 'center',
    },

    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 4,
    },
    checkboxBox: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderWidth: 1.5,
      borderColor: palette.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.surface,
    },
    checkboxBoxChecked: {
      backgroundColor: palette.primary,
      borderColor: palette.primary,
    },
    checkboxLabel: {
      flex: 1,
      fontSize: 14.5,
      color: palette.textSoft,
    },

    callout: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      backgroundColor: palette.accentSoft,
      borderRadius: 14,
      paddingVertical: 13,
      paddingHorizontal: 15,
    },
    calloutText: {
      flex: 1,
      fontSize: 13.5,
      fontWeight: '600',
      color: palette.text,
    },

    sectionHeading: {
      gap: 3,
    },
    sectionTitle: {
      fontSize: 16.5,
      fontWeight: '800',
      color: palette.text,
    },
    sectionCaption: {
      fontSize: 13,
      color: palette.muted,
    },

    segmentRow: {
      gap: 8,
      paddingVertical: 2,
    },
    segment: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: palette.surfaceSunken,
    },
    segmentActive: {
      backgroundColor: palette.primary,
    },
    segmentLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: palette.muted,
    },
    segmentLabelActive: {
      color: '#FFFFFF',
    },
  });
}

import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  type TextProps,
  type TextInputProps,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { PropsWithChildren, ReactNode } from "react";
import { ArrowLeft, ChevronRight, type LucideIcon } from "lucide-react-native";
import { router } from "expo-router";
import { useTheme, useResponsive } from "../core/theme/theme";
export function Label({
  children,
  muted = false,
  style,
  ...props
}: PropsWithChildren<TextProps & { muted?: boolean }>) {
  const { colors } = useTheme();
  return (
    <Text
      {...props}
      style={[
        {
          color: muted ? colors.muted : colors.text,
          fontSize: 14,
          lineHeight: 21,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Title({ children }: PropsWithChildren) {
  return (
    <Label
      style={{
        fontSize: 26,
        lineHeight: 33,
        fontWeight: "700",
        letterSpacing: -0.7,
      }}
    >
      {children}
    </Label>
  );
}
export function Button({
  title,
  onPress,
  icon: Icon,
  variant = "primary",
  disabled = false,
  loading = false,
  testID,
}: {
  title: string;
  onPress: () => void;
  icon?: LucideIcon;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const foreground =
    variant === "primary"
      ? colors.accentText
      : variant === "danger"
        ? colors.danger
        : colors.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 48,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          backgroundColor:
            variant === "primary" ? colors.accent : colors.raised,
          opacity: disabled || loading ? 0.4 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : Icon ? (
        <Icon size={18} color={foreground} />
      ) : null}
      <Text style={{ color: foreground, fontWeight: "700", fontSize: 14 }}>
        {title}
      </Text>
    </Pressable>
  );
}
export function IconButton({
  icon: Icon,
  label,
  onPress,
  active = false,
  disabled = false,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        minWidth: 44,
        minHeight: 44,
        padding: 10,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? colors.accent : colors.surface,
        opacity: disabled ? 0.3 : pressed ? 0.7 : 1,
      })}
    >
      <Icon size={21} color={active ? colors.accentText : colors.text} />
    </Pressable>
  );
}
export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          padding: 16,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          gap: 12,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 7 }}>
      <Label style={{ fontWeight: "600" }}>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        {...props}
        style={[
          {
            minHeight: 48,
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 11,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 15,
            textAlignVertical: props.multiline ? "top" : "center",
          },
          props.style,
        ]}
      />
    </View>
  );
}
export function Page({
  children,
  title,
  subtitle,
  back,
  action,
}: PropsWithChildren<{
  title?: string;
  subtitle?: string;
  back?: boolean;
  action?: ReactNode;
}>) {
  const { colors } = useTheme();
  const { tablet } = useResponsive();
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          width: "100%",
          maxWidth: 1120,
          alignSelf: "center",
          padding: tablet ? 32 : 20,
          paddingBottom: 36,
          gap: 22,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {back && (
            <IconButton
              icon={ArrowLeft}
              label="Geri"
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/")
              }
            />
          )}
          <View style={{ flex: 1 }}>
            {title && <Title>{title}</Title>}
            {subtitle && (
              <Label muted style={{ marginTop: 4 }}>
                {subtitle}
              </Label>
            )}
          </View>
          {action}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
export function StateView({
  title,
  description,
  loading,
  action,
}: {
  title: string;
  description?: string;
  loading?: boolean;
  action?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Card style={{ alignItems: "center", paddingVertical: 28 }}>
      {loading && <ActivityIndicator color={colors.accent} />}
      <Label style={{ fontSize: 17, fontWeight: "600", textAlign: "center" }}>
        {title}
      </Label>
      {description && (
        <Label muted style={{ textAlign: "center", maxWidth: 400 }}>
          {description}
        </Label>
      )}
      {action}
    </Card>
  );
}
export function MenuRow({
  icon: Icon,
  title,
  description,
  onPress,
  badge,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  onPress: () => void;
  badge?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 14,
        minHeight: 66,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View
        style={{
          backgroundColor: colors.raised,
          borderRadius: 10,
          padding: 11,
        }}
      >
        <Icon size={20} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Label style={{ fontWeight: "600" }}>{title}</Label>
        {description && (
          <Label muted style={{ fontSize: 12 }}>
            {description}
          </Label>
        )}
      </View>
      {badge && (
        <Label muted style={{ fontSize: 10 }}>
          {badge}
        </Label>
      )}
      <ChevronRight size={17} color={colors.muted} />
    </Pressable>
  );
}
export const ui = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  grow: { flex: 1 },
});

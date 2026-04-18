import React, { useState, useCallback } from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import { Text } from "react-native-paper";
import { ScreenWrapper } from "../../components/ui/ScreenWrapper";
import {
  useAppColors,
  useThemePreference,
} from "../../providers/ThemeProvider";
import { db } from "../../lib/localDb";
import { fetchAndStoreDailyWeather } from "../../lib/syncEngine";
import { useFocusEffect } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LineChart, BarChart, PieChart } from "react-native-gifted-charts";

interface GraphPoint {
  label: string;
  value: number;
}

interface BarPoint {
  label: string;
  value: number;
  frontColor: string;
}

interface EnvContext {
  avg_temperature: number | null;
  max_humidity: number | null;
  barometric_pressure: number | null;
  weather_condition: string | null;
}

interface DashboardData {
  painTrend: GraphPoint[];
  pressureTrend: GraphPoint[];
  stressTrend: BarPoint[];
  triggerStats: { medicine: number; food: number };
  todayEnv: EnvContext | null;
  highestPainBodyPart: string | null;
  latestStress: string;
  activeBodyParts: { name: string; swelling: boolean }[];
  actionCount: number;
}

const STAGGER_MS = 150;

export default function HomeScreen() {
  const colors = useAppColors();
  const { appliedTheme } = useThemePreference();
  const [data, setData] = useState<DashboardData>({
    painTrend: [],
    pressureTrend: [],
    stressTrend: [],
    triggerStats: { medicine: 0, food: 0 },
    todayEnv: null,
    highestPainBodyPart: null,
    latestStress: "None",
    activeBodyParts: [],
    actionCount: 0,
  });

  const loadDashboardData = useCallback(async () => {
    // 1. Ensure today's weather is prepared
    const today = new Date();
    const currentDate = today.toISOString().split("T")[0];
    await fetchAndStoreDailyWeather(currentDate);

    // 2. 7-Day Pain Trend + Pressure Trend
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const isoString = d.toISOString().split("T")[0];
      const shortDay = d.toLocaleDateString("en-US", { weekday: "short" });
      return { iso: isoString, label: shortDay };
    });

    const placeholders = dates.map(() => "?").join(",");
    const dateValues = dates.map((d) => d.iso);

    const painRows = db.getAllSync<{ log_date: string; max_pain: number }>(
      `
      SELECT log_date, MAX(pain_level) as max_pain 
      FROM pain_logs 
      WHERE log_date IN (${placeholders})
      GROUP BY log_date
    `,
      dateValues,
    );

    const envRows = db.getAllSync<{
      log_date: string;
      barometric_pressure: number;
    }>(
      `
      SELECT date as log_date, barometric_pressure 
      FROM daily_environmental_context 
      WHERE date IN (${placeholders})
    `,
      dateValues,
    );

    const painMap = new Map(painRows.map((r) => [r.log_date, r.max_pain]));
    const envMap = new Map(
      envRows.map((r) => [r.log_date, r.barometric_pressure]),
    );

    const painTrend = dates.map((d) => ({
      label: d.label,
      value: painMap.get(d.iso) || 0,
    }));

    const pressureTrend = dates.map((d) => {
      // Normalize pressure to show correctly without destroying pain chart scale
      // E.g., 1000hPa ~ 1030hPa -> Normalize or use secondary scale prop in Gifted Charts
      const pressure = envMap.get(d.iso) || 1012;
      return {
        label: d.label,
        value: pressure,
      };
    });

    // 3. Stress Trend (7 days)
    const STRESS_VALS: Record<string, number> = {
      low: 1,
      moderate: 2,
      mid: 2,
      high: 3,
    };
    const stressTrendRows = db.getAllSync<{ log_date: string; level: string }>(
      `SELECT log_date, level FROM stress_logs WHERE log_date IN (${placeholders})`,
      dateValues,
    );
    const stressTrendMap = new Map<string, number>();
    stressTrendRows.forEach((r) => {
      if (!r.level) return;
      const v = STRESS_VALS[r.level.toLowerCase()] || 0;
      if (v > (stressTrendMap.get(r.log_date) || 0)) {
        stressTrendMap.set(r.log_date, v);
      }
    });

    const stressTrend = dates.map((d) => {
      const val = stressTrendMap.get(d.iso) || 0;
      let color: string = colors.surfaceVariant; // Default (none)
      if (val === 1) color = colors.chartPositive;
      if (val === 2) color = colors.tertiary;
      if (val === 3) color = colors.error;
      return { label: d.label, value: val, frontColor: color };
    });

    // 4. Trigger Stats (7 days)
    const medsCountTotal =
      db.getFirstSync<{ count: number }>(
        `SELECT COUNT(*) as count FROM medicine_logs WHERE log_date IN (${placeholders})`,
        dateValues,
      )?.count || 0;

    const foodsCountTotal =
      db.getFirstSync<{ count: number }>(
        `SELECT COUNT(*) as count FROM food_logs WHERE log_date IN (${placeholders})`,
        dateValues,
      )?.count || 0;

    // 5. Today's Status
    const todayEnvRow = db.getFirstSync<EnvContext>(
      `
      SELECT avg_temperature, max_humidity, barometric_pressure, weather_condition 
      FROM daily_environmental_context 
      WHERE date = ?
    `,
      [currentDate],
    );

    const stressRow = db.getFirstSync<{ level: string }>(
      `
      SELECT level FROM stress_logs 
      WHERE log_date = ? 
      ORDER BY logged_at DESC LIMIT 1
    `,
      [currentDate],
    );
    const latestStress = stressRow?.level || "None";

    const bodyPartsRows = db.getAllSync<{
      body_part: string;
      max_pain: number;
      max_swell: number;
    }>(
      `
      SELECT body_part, MAX(pain_level) as max_pain, MAX(swelling) as max_swell 
      FROM pain_logs 
      WHERE log_date = ? AND body_part IS NOT NULL 
      GROUP BY body_part 
      ORDER BY max_pain DESC
    `,
      [currentDate],
    );

    const highestPainBodyPart =
      bodyPartsRows.length > 0 ? bodyPartsRows[0].body_part : null;
    const activeBodyParts = bodyPartsRows.map((r) => ({
      name: r.body_part,
      swelling: r.max_swell === 1,
    }));

    const medCount =
      db.getFirstSync<{ count: number }>(
        `
      SELECT COUNT(*) as count FROM medicine_logs WHERE log_date = ?
    `,
        [currentDate],
      )?.count || 0;

    const foodCount =
      db.getFirstSync<{ count: number }>(
        `
      SELECT COUNT(*) as count FROM food_logs WHERE log_date = ?
    `,
        [currentDate],
      )?.count || 0;

    setData({
      painTrend,
      pressureTrend,
      stressTrend,
      triggerStats: { medicine: medsCountTotal, food: foodsCountTotal },
      todayEnv: todayEnvRow || null,
      highestPainBodyPart,
      latestStress,
      activeBodyParts,
      actionCount: medCount + foodCount,
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData]),
  );

  const getStressColor = (level: string) => {
    const l = level.toLowerCase();
    if (l === "high") return colors.error;
    if (l === "moderate" || l === "mid") return colors.tertiary;
    if (l === "low") return colors.chartPositive;
    return colors.textMuted;
  };

  const customDataPoint = () => {
    return (
      <View
        style={[
          styles.glowDot,
          {
            backgroundColor: colors.surface,
            borderColor: colors.chartTrigger,
            shadowColor: colors.chartTrigger,
          },
        ]}
      />
    );
  };

  return (
    <ScreenWrapper>
      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Header Section */}
        <Animated.View entering={FadeInDown.delay(STAGGER_MS * 0).springify()}>
          <Text
            variant="headlineMedium"
            style={{ color: colors.text, fontWeight: "700" }}
          >
            Overview
          </Text>
          <Text
            variant="titleMedium"
            style={{ color: colors.textMuted, marginTop: 4 }}
          >
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </Text>
        </Animated.View>

        {/* 2. Hero Graph: The 7-Day Pain Map */}
        <Animated.View
          entering={FadeInDown.delay(STAGGER_MS * 1).springify()}
          style={{ marginTop: 24 }}
        >
          <View
            style={[
              styles.glassCard,
              {
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.ghostBorder,
              },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 24,
              }}
            >
              <Text
                variant="titleMedium"
                style={{
                  color: colors.text,
                  fontWeight: "600",
                }}
              >
                Pain & Pressure (7 Days)
              </Text>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: colors.chartTrigger,
                    }}
                  />
                  <Text
                    variant="labelSmall"
                    style={{ color: colors.textMuted }}
                  >
                    Pain
                  </Text>
                </View>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <View
                    style={{
                      width: 12,
                      height: 2,
                      backgroundColor: colors.ambientPrimary,
                    }}
                  />
                  <Text
                    variant="labelSmall"
                    style={{ color: colors.textMuted }}
                  >
                    Pressure
                  </Text>
                </View>
              </View>
            </View>
            {data.painTrend.length > 0 && (
              <View style={{ marginLeft: -10, marginBottom: -10 }}>
                <LineChart
                  data={data.painTrend}
                  data2={data.pressureTrend}
                  thickness={3}
                  thickness2={2}
                  color={colors.chartTrigger}
                  color2={colors.ambientPrimary}
                  curved
                  hideYAxisText
                  hideRules
                  hideDataPoints={false}
                  hideDataPoints2={true}
                  customDataPoint={customDataPoint}
                  areaChart
                  startFillColor={colors.chartTrigger}
                  startOpacity={0.25}
                  endFillColor="transparent"
                  endOpacity={0}
                  spacing={48}
                  initialSpacing={24}
                  yAxisThickness={0}
                  xAxisThickness={0}
                  xAxisLabelTextStyle={{
                    color: colors.textMuted,
                    fontSize: 12,
                  }}
                  height={140}
                  isAnimated
                  animationDuration={1200}
                />
              </View>
            )}
          </View>
        </Animated.View>

        {/* 2.5 Secondary Analytics: Stress & Triggers */}
        <Animated.View
          entering={FadeInDown.delay(STAGGER_MS * 1.5).springify()}
          style={{ marginTop: 24, flexDirection: "row", gap: 12 }}
        >
          {/* Stress Trend Bar Chart */}
          <View
            style={[
              styles.glassCard,
              {
                flex: 1,
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.ghostBorder,
                padding: 16,
              },
            ]}
          >
            <Text
              variant="labelLarge"
              style={{
                color: colors.text,
                fontWeight: "600",
                marginBottom: 16,
              }}
            >
              Stress Trend
            </Text>
            <View style={{ marginLeft: -12, marginTop: -4 }}>
              {data.stressTrend.length > 0 && (
                <BarChart
                  data={data.stressTrend}
                  height={80}
                  yAxisThickness={0}
                  xAxisThickness={0}
                  hideYAxisText
                  hideRules
                  barWidth={12}
                  barBorderRadius={6}
                  spacing={12}
                  initialSpacing={8}
                  isAnimated
                  xAxisLabelTextStyle={{
                    color: colors.textMuted,
                    fontSize: 10,
                  }}
                />
              )}
            </View>
          </View>

          {/* Triggers Donut Chart */}
          <View
            style={[
              styles.glassCard,
              {
                flex: 1,
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.ghostBorder,
                padding: 16,
                alignItems: "center",
              },
            ]}
          >
            <Text
              variant="labelLarge"
              style={{
                color: colors.text,
                fontWeight: "600",
                marginBottom: 12,
              }}
            >
              Triggers Logged
            </Text>
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                marginTop: -4,
              }}
            >
              <PieChart
                donut
                radius={36}
                innerRadius={24}
                data={[
                  {
                    value: data.triggerStats.medicine || 0.1,
                    color: colors.primary,
                  },
                  {
                    value: data.triggerStats.food || 0.1,
                    color: colors.secondary,
                  },
                ]}
                centerLabelComponent={() => (
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "700",
                      fontSize: 16,
                    }}
                  >
                    {data.triggerStats.medicine + data.triggerStats.food}
                  </Text>
                )}
              />
            </View>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.primary,
                  }}
                />
                <Text style={{ color: colors.textMuted, fontSize: 10 }}>
                  Meds
                </Text>
              </View>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.secondary,
                  }}
                />
                <Text style={{ color: colors.textMuted, fontSize: 10 }}>
                  Food
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* 3. Daily Context (Weather Impact) */}
        {data.todayEnv && (
          <Animated.View
            entering={FadeInDown.delay(STAGGER_MS * 2).springify()}
            style={{ marginTop: 24 }}
          >
            <Text
              variant="titleMedium"
              style={{
                color: colors.text,
                fontWeight: "600",
                marginBottom: 12,
              }}
            >
              Daily Context
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12 }}
            >
              <View
                style={[
                  styles.glassCard,
                  styles.envCard,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.ghostBorder,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="weather-partly-cloudy"
                  size={24}
                  color={colors.primary}
                />
                <View>
                  <Text
                    variant="labelMedium"
                    style={{ color: colors.textMuted }}
                  >
                    Conditions
                  </Text>
                  <Text
                    variant="titleMedium"
                    style={{ color: colors.text, fontWeight: "600" }}
                  >
                    {data.todayEnv.weather_condition}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.glassCard,
                  styles.envCard,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.ghostBorder,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="thermometer"
                  size={24}
                  color={colors.tertiary}
                />
                <View>
                  <Text
                    variant="labelMedium"
                    style={{ color: colors.textMuted }}
                  >
                    Avg Temp
                  </Text>
                  <Text
                    variant="titleMedium"
                    style={{ color: colors.text, fontWeight: "600" }}
                  >
                    {data.todayEnv.avg_temperature}°C
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.glassCard,
                  styles.envCard,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.ghostBorder,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="gauge"
                  size={24}
                  color={colors.secondary}
                />
                <View>
                  <Text
                    variant="labelMedium"
                    style={{ color: colors.textMuted }}
                  >
                    Pressure
                  </Text>
                  <Text
                    variant="titleMedium"
                    style={{ color: colors.text, fontWeight: "600" }}
                  >
                    {data.todayEnv.barometric_pressure} hPa
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.glassCard,
                  styles.envCard,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.ghostBorder,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="water-percent"
                  size={24}
                  color={colors.secondary}
                />
                <View>
                  <Text
                    variant="labelMedium"
                    style={{ color: colors.textMuted }}
                  >
                    Humidity
                  </Text>
                  <Text
                    variant="titleMedium"
                    style={{ color: colors.text, fontWeight: "600" }}
                  >
                    {data.todayEnv.max_humidity}%
                  </Text>
                </View>
              </View>
            </ScrollView>

            {data.highestPainBodyPart && (
              <View
                style={[
                  styles.glassCard,
                  {
                    marginTop: 16,
                    backgroundColor: colors.surfaceContainerHigh,
                    borderColor: colors.ghostBorder,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="lightning-bolt"
                  size={24}
                  color={colors.chartTrigger}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    variant="labelLarge"
                    style={{ color: colors.text, fontWeight: "500" }}
                  >
                    Relational Insight
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={{ color: colors.textMuted, marginTop: 4 }}
                  >
                    Today's highest pain ({data.highestPainBodyPart}) correlates
                    with{" "}
                    {data.todayEnv.weather_condition?.toLowerCase() ||
                      "unknown"}{" "}
                    weather conditions and {data.todayEnv.barometric_pressure}{" "}
                    hPa pressure.
                  </Text>
                </View>
              </View>
            )}
          </Animated.View>
        )}

        {/* 4. Today's Clinical Summary */}
        <Animated.View
          entering={FadeInDown.delay(STAGGER_MS * 3).springify()}
          style={styles.gridContainer}
        >
          <View
            style={[
              styles.glassCard,
              styles.gridItem,
              {
                backgroundColor: colors.surfaceContainerHighest,
                borderColor: colors.ghostBorder,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="brain"
              size={28}
              color={colors.icon}
              style={{ marginBottom: 12 }}
            />
            <Text variant="labelLarge" style={{ color: colors.textMuted }}>
              Current Stress
            </Text>
            <Text
              variant="titleLarge"
              style={{
                color: getStressColor(data.latestStress),
                fontWeight: "700",
                marginTop: 4,
                textTransform: "capitalize",
              }}
            >
              {data.latestStress}
            </Text>
          </View>

          <View
            style={[
              styles.glassCard,
              styles.gridItem,
              {
                backgroundColor: colors.surfaceContainerHighest,
                borderColor: colors.ghostBorder,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="pill"
              size={28}
              color={colors.icon}
              style={{ marginBottom: 12 }}
            />
            <Text variant="labelLarge" style={{ color: colors.textMuted }}>
              Triggers Logged
            </Text>
            <Text
              variant="titleLarge"
              style={{ color: colors.text, fontWeight: "700", marginTop: 4 }}
            >
              {data.actionCount}
            </Text>
          </View>
        </Animated.View>

        {/* 5. Active Zones (Body Map Summary) */}
        <Animated.View
          entering={FadeInDown.delay(STAGGER_MS * 4).springify()}
          style={{ marginTop: 24 }}
        >
          <Text
            variant="titleMedium"
            style={{ color: colors.text, fontWeight: "600", marginBottom: 16 }}
          >
            Affected Areas Today
          </Text>

          <View style={styles.chipsContainer}>
            {data.activeBodyParts.length > 0 ? (
              data.activeBodyParts.map((part, i) => (
                <View
                  key={i}
                  style={[
                    styles.chip,
                    { backgroundColor: colors.surfaceVariant },
                  ]}
                >
                  <Text style={{ color: colors.text, fontWeight: "500" }}>
                    {part.name}
                  </Text>
                  {part.swelling && (
                    <View
                      style={[
                        styles.swellingIndicator,
                        { backgroundColor: colors.error },
                      ]}
                    />
                  )}
                </View>
              ))
            ) : (
              <Text style={{ color: colors.textMuted, fontStyle: "italic" }}>
                No pain regions logged today
              </Text>
            )}
          </View>
        </Animated.View>
      </Animated.ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 24,
    paddingBottom: 140,
  },
  glassCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    overflow: "hidden",
  },
  envCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  glowDot: {
    width: 12,
    height: 12,
    borderWidth: 2,
    borderRadius: 6,
    shadowRadius: 6,
    shadowOpacity: 0.8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  gridContainer: {
    flexDirection: "row",
    gap: 16,
    marginTop: 24,
  },
  gridItem: {
    flex: 1,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 24,
  },
  swellingIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 8,
  },
});

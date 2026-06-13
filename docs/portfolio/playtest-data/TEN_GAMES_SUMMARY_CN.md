# DreamCards 十局模拟汇总

## 样本范围

- 模拟局数：10
- 总回合数：113
- 获胜分数线：30
- 平均每局回合数：11.3
- 对局长度范围：9–13 回合
- AI模式：本地 fallback 策略（不消耗外部模型额度）

## 核心指标

| 中文指标 | 字段 | 结果 |
|---|---|---:|
| 全员猜中率 | all_correct_rate | 3.54% |
| 无人猜中率 | none_correct_rate | 30.09% |
| 部分猜中率 | partial_correct_rate | 66.37% |
| 平均票数集中度 | vote_concentration | 53.98% |
| 平均提示词长度 | clue_length | 4.9204 字 |

回合分布：全员猜中 4 回合，无人猜中 34 回合，部分猜中 75 回合。

## 玩家汇总

| 玩家 | 胜局数 | 投票正确率 | 平均每回合得分 | 平均终局总分 |
|---|---:|---:|---:|---:|
| you | 2 | 34.57% | 2.177 | 24.6 |
| AI_Alice | 5 | 33.33% | 2.2743 | 25.7 |
| AI_Bob | 2 | 40.00% | 2.3894 | 27 |
| AI_Carol | 2 | 34.83% | 1.9912 | 22.5 |

## 单局胜者

| 游戏编号 | 胜者 | 最终分数 |
|---|---|---|
| game_01 | AI_Alice | you 26；AI_Alice 31；AI_Bob 27；AI_Carol 25 |
| game_02 | AI_Alice | you 21；AI_Alice 30；AI_Bob 26；AI_Carol 10 |
| game_03 | AI_Carol | you 22；AI_Alice 25；AI_Bob 31；AI_Carol 33 |
| game_04 | you | you 31；AI_Alice 20；AI_Bob 26；AI_Carol 22 |
| game_05 | AI_Bob | you 26；AI_Alice 23；AI_Bob 31；AI_Carol 25 |
| game_06 | AI_Alice | you 27；AI_Alice 30；AI_Bob 17；AI_Carol 22 |
| game_07 | you、AI_Alice | you 31；AI_Alice 31；AI_Bob 29；AI_Carol 20 |
| game_08 | AI_Bob | you 18；AI_Alice 16；AI_Bob 30；AI_Carol 16 |
| game_09 | AI_Alice | you 21；AI_Alice 32；AI_Bob 28；AI_Carol 21 |
| game_10 | AI_Carol | you 23；AI_Alice 19；AI_Bob 25；AI_Carol 31 |

## 数据口径

- 对局持续轮换说书人，直到回合结算后最高分达到 30 分。
- 票数集中度 = 单张牌最高得票数 / 本回合总票数。
- 提示词长度按 Unicode 字符数统计，不包含首尾空白。
- 说书人不投票；其 vote_target 与 vote_correct 记录为 null。
- winner 表示该玩家是否并列或独占本局最高总分。

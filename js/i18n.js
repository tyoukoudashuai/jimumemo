(() => {
  'use strict';
  // Stable stored names/IDs stay in their original language; only display text changes.
  const dictionary = `
保存すると疲労を参考にカレンダーの次回予定を更新します。|保存后会参考疲劳更新日历中的下次安排。|Saving updates your next calendar session using your fatigue rating.
仮予定|暂定安排|Tentative
疲労3は24時間、疲労4〜5は48時間の予定上の余裕を追加します。回復時間の予測ではありません。|疲劳 3 分增加 24 小时安排缓冲，4–5 分增加 48 小时。这是排期余量，实际恢复需重新评估。|Fatigue 3 adds a 24-hour scheduling buffer; 4–5 adds 48 hours. This is planning slack, not a recovery prediction.
各記録で最も重い重量帯のセットを比較します。回数比較には中央のセット（偶数の場合は少ない側）を使います。|比较每次训练最重重量的组，次数取中位数组（偶数时取较低的一组）。|Compare the heaviest sets in each workout, using the lower median rep count.
目標設定を確認してください。|请检查目标设置。|Check your targets.
目標回数、目標RIR、重量の刻み幅を設定すると判定できます。|请设置目标次数、RIR 和重量档位。|Set your rep range, RIR range and weight increment.
直近2回で、RIR 0（目標を下回る場合は1も含む）または疲労の自己評価4以上が続きました。|连续两次出现 RIR 0（低于目标时也含 RIR 1）或疲劳自评至少 4 分。|Two sessions had RIR 0 (or 1 below target), or fatigue ratings of at least 4.
同じ重量で、負担が大きい可能性を示す記録が続いています。|同重量下，连续记录提示负担可能较大。|Repeated records at the same weight suggest strain.
次回は重量やセット数を抑えることを検討しましょう。体調やフォームも確認してください。|下次可考虑减少重量或组数，并检查身体状态和动作质量。|Consider reducing weight or sets next time. Review your condition and form.
次回も現在の重量と回数を目安にしましょう。|下次以当前重量和次数为参考。|Use your current weight and reps as a guide next time.
現在のコンディションに注意が必要です。|当前身体状态需要注意。|Your current condition needs attention.
重量や回数を増やすことは見送り、体調に合わせて休息や調整を検討しましょう。|暂缓增加重量或次数，根据身体状态考虑休息或调整。|Hold off on increases and consider rest or adjustments based on your condition.
最新のコンディションの自己評価を参考に、増量・回数追加を表示しません。|根据最新身体自评，暂缓增重或加次数。|Your latest check-in puts weight and rep increases on hold.
最近の疲労の自己評価が高めです。|近期疲劳自评偏高。|Recent fatigue ratings are high.
次回は体調を確認し、重量や回数を増やすかは慎重に判断しましょう。|下次先确认身体状态，谨慎决定是否加量。|Check your condition before considering any increase.
直近の疲労の自己評価が4以上でした。|最近疲劳自评至少 4 分。|The latest fatigue rating was at least 4.
比較対象にRIR 0または目標RIRを下回るセットがあります。|比较组中出现 RIR 0 或低于目标的 RIR。|Some comparison sets have RIR 0 or RIR below target.
次回は重量を維持し、回数を増やす前に体調とフォームを確認しましょう。|下次保持重量，增加次数前先检查状态和动作质量。|Keep the weight and check your condition and form before adding reps.
自重種目で、直近2回とも目標の上限回数に達しました。|自重动作连续两次达到次数上限。|The last two bodyweight sessions reached the rep ceiling.
現在の回数とフォームを維持しましょう。|保持当前次数和动作质量。|Maintain your current reps and form.
0 kgで記録した種目には重量の加算を提案しません。|记录为 0 kg 的动作不生成公斤增重建议。|Exercises logged at 0 kg receive no kilogram increase.
直近2回とも目標の上限回数に達しました。|最近两次均达到次数上限。|Both recent sessions reached the rep ceiling.
現在の重量を維持し、利用できる刻み幅を確認しましょう。|保持当前重量，并确认可用的增重档位。|Keep your current weight and check available increments.
同じ重量で、直近2回とも全対象セットが目標上限の回数に達し、RIRにも余裕がありました。|同重量下，最近两次的所有比较组均达到次数上限，且 RIR 有余量。|At the same weight, all work sets reached the rep ceiling twice with reps in reserve.
同じ重量で回数が増え、RIRも目標範囲内です。|同重量次数增加，且 RIR 在目标范围内。|Reps increased at the same weight with RIR in range.
同じ重量と回数で、RIRは目標範囲内です。|重量和次数稳定，RIR 在目标范围内。|Weight and reps are stable with RIR in range.
目標の上限回数に達するまで、重量は維持して1回ずつ増やします。|达到次数上限前，保持重量，每次增加 1 次重复。|Keep the weight and add one rep at a time up to the ceiling.
直近の記録からは、重量や回数を増やす条件がそろっていません。|最近记录尚未满足增加重量或次数的条件。|Recent records do not yet support increasing weight or reps.
RIRの記録がないセットあり|部分组缺少 RIR|Some sets lack RIR
RIRの記録はありません。|没有 RIR 记录。|No RIR recorded.
対象の完了記録がまだないため、候補日時は表示できません。|暂无相关训练记录，无法生成候选时间。|No related completed workouts are available to calculate a date.
強い痛みや普段と違う症状がある場合は、アプリの候補日を根拠にトレーニングを続けないでください。|如有强烈疼痛或异常症状，请勿依据候选日期继续训练。|Do not use a candidate date to continue training through severe pain or unusual symptoms.
普段と違う強い症状がある場合は、アプリの提案を頼りにトレーニングを続けないでください。|如有异常严重症状，请勿依据应用建议继续训练。|Do not continue training based on app suggestions if you have unusual severe symptoms.
疲労と対象部位すべての筋肉痛を記録すると、現在の状態を確認できます。|填写疲劳和所有相关部位的酸痛，以确认当前状态。|Record fatigue and soreness for all relevant muscles to check your condition.
現在の疲労が未入力です。コンディションを確認してください。|尚未填写当前疲劳，请检查身体状态。|Current fatigue is missing. Check your condition.
設定間隔に達し、最新の自己評価に強い疲労や筋肉痛は報告されていません。|已达到设定间隔，最新自评未报告明显疲劳或酸痛。|Your preferred interval has passed and your latest check-in reports no severe fatigue or soreness.
設定間隔にまだ達していません。候補日時以降に状態を確認してください。|尚未达到设定间隔，请在候选时间之后重新检查状态。|Your preferred interval has not passed. Check your condition at or after the candidate time.
この目標は、同じ種目を使うすべてのプランで共有されます。|同一动作的所有计划共用此目标。|These targets apply to this exercise across all plans.
有効な日付とトレーニング名を入力してください。|请输入有效日期和训练名称。|Enter a valid date and workout name.
数値を確認してください。睡眠時間は0〜24時間で入力できます。|请检查数值，睡眠时长为 0–24 小时。|Check your values. Sleep duration must be 0–24 hours.
ブラウザーの保存領域にアクセスできません。設定を確認してから、ページを開き直してください。|无法访问浏览器存储，请检查设置后重新打开页面。|Browser storage is unavailable. Check settings and reopen the page.
保存データを読み込めません。元のデータはブラウザーに残っています。|无法读取保存的数据，原数据仍保留在浏览器中。|Stored data could not be read. The original data remains in your browser.
ブラウザーの保存機能を利用できません。設定をご確認ください。|浏览器存储不可用，请检查设置。|Browser storage is unavailable. Check your settings.
別のタブで記録が変更されました。ページを再読み込みして、最新の記録を表示してください。|其他标签页已修改记录，请刷新加载最新数据。|Records changed in another tab. Reload to display the latest data.
変更を保存できませんでした。ブラウザーの保存設定や空き容量を確認してください。|未能保存，请检查浏览器存储设置和剩余空间。|Could not save. Check browser storage settings and available space.
画面上部の保存に関する案内を確認してください。|请查看页面顶部的保存提示。|Check the storage message at the top of the page.
完了するには、少なくとも1セットの重量と回数を入力してください。|请至少填写一组重量和次数后再完成训练。|Enter weight and reps for at least one set to complete the workout.
回数は1以上の整数、RIRは0〜10の整数で、下限が上限以下になるよう設定してください。増量幅は0より大きい数値を入力してください。|次数须为正整数，RIR 为 0–10 整数，下限不高于上限，增重档位须大于 0。|Use positive whole-number reps and RIR 0–10, with minimum no higher than maximum. The weight increment must be positive.
重量または回数が大きすぎます。|重量或次数过大。|Weight or reps are too large.
メインコンテンツへ移動|跳到主要内容|Skip to content
この日のリカバリー|当天恢复情况|Recovery for this day
トレーニング日の表示順|训练日排序|Training day order
ドラッグして並べ替え|拖动排序|Drag to reorder
分割プラン|分化计划|Split plan
履歴の絞り込み|历史筛选|Filter history
間隔のプリセット|间隔预设|Interval presets
を参照|参考|referenced
直近|最近|Latest
重量の刻み幅|重量档位|Weight increment
ダッシュボード|仪表盘|Dashboard
ホーム|首页|Home
トレーニングプラン|训练计划|Training plan
プラン|计划|Plan
履歴|历史|History
進捗|进度|Progress
リカバリー|恢复|Recovery
カレンダー|日历|Calendar
ワークスペース|工作区|Workspace
この端末に保存|保存在此设备|Saved on this device
今日のトレーニングを|开始今天的|Start today's
始めよう。|训练。|workout.
現在のプラン|当前计划|Current plan
選択中のプラン|当前计划|Selected plan
分割プラン、前回の記録、進捗の推移をひと目で確認。|一览分化计划、上次记录和训练进步。|Review your split plan, previous results and progress.
トレーニングを始める|开始训练|Start training
進捗を見る|查看进度|View progress
プランを開く|打开计划|Open plan
今日のプラン|今日计划|Today's plan
前回の記録|上次记录|Previous workout
最近の進捗|近期进步|Recent progress
記録はまだありません|暂无记录|No records yet
トレーニング完了後に表示|完成训练后显示|Available after a workout
初回の記録|首次记录|First record
前回と同じ|与上次相同|Same as last time
前回比|较上次|Change
今週のサマリー|本周概览|This week
トレーニング回数|训练次数|Workouts
総セット数|总组数|Total sets
総トレーニング量|训练总量|Training volume
最近のトレーニング|最近训练|Recent workouts
履歴を見る|查看历史|View history
トレーニング記録はまだありません|暂无训练记录|No workouts recorded yet
完了したトレーニングがここに表示されます。|完成的训练将显示在这里。|Completed workouts appear here.
トレーニング日を組み立て、種目ごとにセットを記録できます。|制定训练日，并逐动作记录每一组。|Organize training days and log each exercise set.
トレーニング日を追加|添加训练日|Add training day
トレーニング日を編集|编辑训练日|Edit training day
トレーニング日を削除|删除训练日|Delete training day
トレーニング日名|训练日名称|Training day name
トレーニング部位|训练部位|Muscle groups
前回のトレーニング|上次训练|Last workout
記録なし|暂无记录|No records
前回|上次|Previous
今回|本次|Latest
セットを追加|添加一组|Add set
セットを複製|复制该组|Copy set
セットを削除|删除该组|Delete set
種目を追加|添加动作|Add exercise
種目名を編集|编辑动作名称|Edit exercise name
種目を削除|删除动作|Delete exercise
種目名|动作名称|Exercise name
新規種目のトレーニング部位|新动作的训练部位|Muscle groups for new exercise
登録済みの種目と同じ名前を入力すると、過去の記録を参照できます。|输入已有动作名称，即可关联过往成绩。|Use an existing exercise name to link its history.
この種目は追加済みです。種目の下からセットを追加できます。|该动作已添加，可在动作下方添加组。|This exercise is already included. Add another set below it.
トレーニング完了|完成训练|Complete workout
トレーニングを記録しました。|训练已保存。|Workout saved.
重量 (kg)|重量 (kg)|Weight (kg)
回数|次数|Reps
RIRはあと何回できるかの目安。|RIR 表示预计还能完成的次数。|RIR estimates how many more reps you could do.
あと何回できるかの目安（任意）|预计还能完成的次数（选填）|Estimated reps remaining (optional)
セットがありません。|暂无训练组。|No sets yet.
この日に記録する種目を追加してください。|请添加当天的训练动作。|Add exercises for this day.
トレーニング日がありません|暂无训练日|No training days
トレーニング日を追加してプランを作成できます。|添加训练日来建立计划。|Add a training day to build your plan.
トレーニング履歴|训练历史|Workout history
完了したトレーニングを振り返り、記録を編集できます。|回顾已完成的训练并编辑记录。|Review and edit completed workouts.
開始日|开始日期|Start date
終了日|结束日期|End date
すべての部位|全部部位|All muscle groups
部位|部位|Muscle group
絞り込みを解除|清除筛选|Clear filters
条件に一致する記録がありません|没有匹配的记录|No matching records
日付や部位を変更してください。|请调整日期或部位筛选。|Try a different date or muscle group.
日付の範囲を確認してください|请检查日期范围|Check the date range
終了日は開始日と同じ日か、それ以降にしてください。|结束日期应为开始日期当天或之后。|The end date must be on or after the start date.
トレーニング記録を編集|编辑训练记录|Edit workout
トレーニング記録を削除|删除训练记录|Delete workout
トレーニング日|训练日期|Workout date
トレーニング名|训练名称|Workout name
トレーニング記録を更新しました。|训练记录已更新。|Workout updated.
トレーニング記録を削除しました。|训练记录已删除。|Workout deleted.
記録を削除|删除记录|Delete record
トレーニングの推移|训练进步|Training progress
種目ごとに、トレーニングで扱った最高重量の変化を確認できます。|查看每个动作的单次训练最高重量变化。|Track the highest weight used for each exercise.
最高重量の推移|最高重量趋势|Maximum weight trend
この種目の記録はまだありません|此动作暂无记录|No records for this exercise
トレーニングを完了すると、最高重量がグラフに表示されます。|完成训练后，图表将显示最高重量。|Complete a workout to see its maximum weight here.
選べる種目がありません|暂无可选动作|No exercises available
種目|动作|Exercise
最高重量|最高重量|Maximum weight
次回のトレーニング提案|下次训练建议|Next workout suggestion
データ不足|数据不足|Insufficient data
現状を維持|维持当前表现|Maintain
重量を上げる|增加重量|Increase weight
回数を1回増やす|增加一次重复|Add one rep
負荷を抑えることを検討|考虑降低负荷|Consider reducing load
目標を編集|编辑目标|Edit targets
種目の目標を編集|编辑动作目标|Edit exercise targets
回数の下限|最低次数|Minimum reps
回数の上限|最高次数|Maximum reps
RIRの下限|RIR 下限|Minimum RIR
RIRの上限|RIR 上限|Maximum RIR
最小の増量幅（kg）|最小增重档位（kg）|Weight increment (kg)
下書きに反映|应用到草稿|Apply to draft
入力中の下書きには反映できません。|已有输入的草稿不会被覆盖。|Clear this exercise's draft before applying a suggestion.
提案の理由を見る|查看建议依据|View reasoning
判断理由を見る|查看判断依据|View reasoning
今回は見送る|暂不采用|Skip this suggestion
提案を表示|显示建议|Show suggestion
この提案を見送りました。|已暂不采用此建议。|Suggestion dismissed.
見送り|暂不采用|Dismissed
分析|分析|Analysis
提案|建议|Suggestion
目標|目标|Target
未入力|未填写|Not entered
次回のトレーニング|下次训练|Next workout
対象部位の最終記録|相关部位最近训练|Last related workout
次回の候補日|下次候选日期|Candidate date
現在のコンディション|当前状态|Current condition
コンディションを確認しましょう|请检查身体状态|Check your condition
トレーニング候補日です|可以考虑训练|Ready to consider
休息・調整を検討|考虑休息或调整|Consider rest or adjustment
コンディションを確認|检查身体状态|Check condition
コンディションチェック|状态检查|Condition check
コンディションを入力|填写身体状态|Log condition
コンディションを編集|编辑身体状态|Edit condition
コンディション履歴|状态历史|Condition history
トレーニング後のコンディション|训练后的身体状态|Post-workout condition
トレーニング後|训练后|After workout
最新の自己評価|最新自评|Latest check-in
再確認が必要|需要重新确认|Check again
部位ごとのリカバリー|各部位恢复情况|Recovery by muscle group
筋肉痛の自己評価なし|未填写酸痛情况|No soreness rating
筋肉痛|肌肉酸痛|Soreness
身体の疲労（0〜5）|身体疲劳（0–5）|Fatigue (0–5)
部位ごとの筋肉痛（0〜5）|各部位酸痛（0–5）|Soreness by muscle (0–5)
体感|主观感受|How you feel
昨晩の睡眠時間|昨晚睡眠时长|Last night's sleep
睡眠の質（1〜5）|睡眠质量（1–5）|Sleep quality (1–5)
睡眠の質|睡眠质量|Sleep quality
疲労|疲劳|Fatigue
睡眠|睡眠|Sleep
とても良い|很好|Very good
かなり疲れている|非常疲劳|Very tired
疲れている|疲劳|Tired
良い|良好|Good
普通|一般|Normal
ほとんどない|几乎没有|Very low
非常に強い|非常严重|Very high
なし|无|None
低い|低|Low
高い|高|High
設定間隔を編集|编辑训练间隔|Edit interval
設定間隔|设定间隔|Preferred interval
間隔（時間）|间隔（小时）|Interval (hours)
未算出|尚未计算|Not available
入力は任意です。気になる項目だけ記録できます。|所有项目均为选填，可只记录关心的项目。|All fields are optional. Record what matters to you.
コンディションを保存しました。|身体状态已保存。|Condition saved.
設定間隔を保存しました。|训练间隔已保存。|Interval saved.
候補日は設定間隔をもとにした日程の目安です。現在の状態は自己評価で確認してください。|候选日期根据设定间隔计算，请结合当前自评确认身体状态。|Candidate dates follow your preferred interval. Check how you feel before training.
予定を立てるときに空けたい時間を設定します。|设置安排训练时希望间隔的小时数。|Set your preferred time between workouts.
自己評価はまだありません。疲労や筋肉痛など、気になる項目から記録できます。|暂无自评，可先记录疲劳或酸痛情况。|No check-ins yet. Start with fatigue or soreness.
コンディションの記録はまだありません。|暂无身体状态记录。|No condition check-ins yet.
入力された項目はありません。|没有已填写的项目。|No fields entered.
トレーニング間隔とコンディションを確認し、次の予定を立てましょう。|结合训练间隔和身体状态，安排下一次训练。|Plan your next session using your interval and current condition.
完了したトレーニングと次回の予定を確認できます。|查看已完成的训练和下次安排。|Review completed workouts and your next session.
強い疲労の報告があるため、予定は保留中です。|你报告了较高疲劳，训练安排暂缓。|Training is on hold due to reported high fatigue.
この予定は見送りました。|已取消此安排。|This session has been dismissed.
手動設定|手动安排|Manually scheduled
自動作成|自动安排|Automatically scheduled
日時を変更|修改时间|Change date and time
自動予定に戻す|恢复自动安排|Restore automatic schedule
予定日時|计划时间|Scheduled time
トレーニング完了後に次回の予定を表示します。|完成训练后将自动显示下次安排。|Your next session appears after completing a workout.
この日の記録・予定はありません。|当天没有训练记录或安排。|No workouts or plans on this date.
予定は設定間隔と自己評価に基づく目安です。体調を確認して調整してください。|安排根据设定间隔与自评生成，请结合身体状态调整。|Schedules use your preferred interval and check-in. Adjust them to how you feel.
有効な日時を入力してください。|请输入有效时间。|Enter a valid date and time.
前の月|上个月|Previous month
次の月|下个月|Next month
今日|今天|Today
完了|已完成|Completed
予定|已安排|Scheduled
月|一|Mon
火|二|Tue
水|三|Wed
木|四|Thu
金|五|Fri
土|六|Sat
日|日|Sun
胸|胸|Chest
背中|背|Back
肩|肩|Shoulders
脚|腿|Legs
腹筋|腹肌|Abs
二頭筋|二头肌|Biceps
三頭筋|三头肌|Triceps
その他|其他|Other
腕|手臂|Arms
ベンチプレス|卧推|Bench press
ダンベルフライ|哑铃飞鸟|Dumbbell fly
ショルダープレス|肩推|Shoulder press
サイドレイズ|侧平举|Lateral raise
トライセプスプッシュダウン|三头下压|Triceps pushdown
ラットプルダウン|高位下拉|Lat pulldown
シーテッドロー|坐姿划船|Seated row
ダンベルカール|哑铃弯举|Dumbbell curl
スクワット|深蹲|Squat
レッグカール|腿弯举|Leg curl
クランチ|卷腹|Crunch
変更を保存|保存修改|Save changes
キャンセル|取消|Cancel
スキップ|跳过|Skip
保存|保存|Save
追加|添加|Add
編集|编辑|Edit
削除|删除|Delete
閉じる|关闭|Close
上に移動|上移|Move up
下に移動|下移|Move down
セット|组|sets
分割|分化| day split
時間経過|小时已过| hours elapsed
時間未満|小时以内| hours or less
時間|小时| hours
回|次| times
重量|重量|Weight
比較できるトレーニングがまだ2回分ありません。|尚无两次可比较的训练。|Two comparable workouts are needed.
同じ重量での回数とRIRを記録しましょう。|请记录相同重量下的次数和 RIR。|Record reps and RIR at the same weight.
直近2回の最も重い重量が異なります。|最近两次的主要工作重量不同。|The two latest working weights differ.
同じ重量での記録がそろうと判定できます。|有相同重量的记录后即可判断。|Record comparable sets at the same weight to get a suggestion.
比較対象のセットにRIRが未入力の記録があります。|参与比较的训练组缺少 RIR。|Some comparison sets have no RIR.
次回は回数とあわせてRIRを記録しましょう。|下次请同时填写次数和 RIR。|Log RIR alongside reps next time.
最近のコンディションに負担の大きさを示す入力があります。|近期自评提示较大负担。|Your recent check-in indicates strain.
トレーニング日名を入力してください。|请输入训练日名称。|Enter a training day name.
種目名を入力してください。|请输入动作名称。|Enter an exercise name.
重量は0以上の数値で入力してください。|重量必须为大于或等于 0 的数值。|Weight must be a number of 0 or more.
回数は1以上の整数で入力してください。|次数必须为正整数。|Reps must be a positive whole number.
RIRは0〜10の整数で入力してください。|RIR 必须是 0–10 的整数。|RIR must be a whole number from 0 to 10.
変更を保存できませんでした。|未能保存修改。|Could not save changes.
保存を確認してください|请检查保存状态|Check storage
この操作は取り消せません。|此操作无法撤销。|This action cannot be undone.
削除しますか？|确定删除？|Delete this item?
を削除します。|将被删除。|will be deleted.
記録|记录|Records
提案を下書きの1セット目に反映しました。|已将建议应用到草稿第一组。|Suggestion applied to the first draft set.
種目の目標を保存しました。|动作目标已保存。|Exercise targets saved.
`.trim().split('\n').map(line=>line.split('|'));
  const lookup=new Map(dictionary.map(([ja,zh,en])=>[ja,{zh,en}]));
  const phrases=[...lookup.keys()].filter(s=>s.length>1).sort((a,b)=>b.length-a.length);
  const pattern=new RegExp(phrases.map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');
  let language='ja';
  try{language=localStorage.getItem('haoFitnessLog:language')||'ja';}catch{}
  if(!['ja','zh','en'].includes(language))language='ja';
  const originals=new WeakMap();
  let customNames=[];
  function setNames(state){
    const names=[...Object.values(state.plans).flatMap(plan=>[plan.name,...plan.days.flatMap(day=>[day.name,...Object.values(day.exerciseNames||{})])]),...state.exerciseCatalog.map(ex=>ex.name),...state.sessions.flatMap(s=>[s.dayName,...s.exercises.map(ex=>ex.name)])];
    customNames=[...new Set(names)].filter(name=>!lookup.has(name)&&!/^\d分割$/.test(name)&&!name.split('・').every(part=>lookup.has(part)));
  }
  const attributes=new WeakMap();
  const templates = [
    ['{0}の最高重量、{1}件のトレーニング','{0} 的最高重量，共 {1} 次训练','Maximum weight for {0}, {1} workouts'],
    ['同じ重量で代表セットの回数が2回連続で{0}回以上減少しました（{1}回 → {2}回 → {3}回）。','同重量代表组连续两次至少减少 {0} 次（{1} → {2} → {3} 次）。','Representative reps dropped by at least {0} twice ({1} → {2} → {3}).'],
    ['トレーニング日名は{0}文字以内で入力してください。','训练日名称不能超过 {0} 个字符。','Training day names must be at most {0} characters.'],
    ['種目名は{0}文字以内で入力してください。','动作名称不能超过 {0} 个字符。','Exercise names must be at most {0} characters.'],
    ['「{0}」と、この日に入力中のセットを削除しますか？','确定删除「{0}」及当天草稿？','Delete “{0}” and its draft sets?'],
    ['「{0}」と、この種目に入力中のセットを削除しますか？','确定删除「{0}」及其草稿组？','Delete “{0}” and its draft sets?'],
    ['「{0}」のセット{1}に有効な数値を入力してください。','请为「{0}」第 {1} 组输入有效数值。','Enter valid numbers for “{0}”, set {1}.'],
    ['次回も{0} kgを維持し、{1}回を目安にしましょう。','下次保持 {0} kg，以 {1} 次为目标。','Keep {0} kg and aim for {1} reps next time.'],
    ['次回は自重のまま{0}回を目安にしましょう。','下次保持自重，以 {0} 次为目标。','Keep bodyweight and aim for {0} reps.'],
    ['体調やフォームに問題がなければ、次回は{0} kgで{1}回を目安に試せます。','如果状态和动作质量良好，下次可尝试 {0} kg × {1} 次。','If condition and form allow, try {0} kg for {1} reps next time.'],
    ['対象部位を最後にトレーニングした日時に、設定した{0}時間を加えています。','最近相关部位训练时间加上设定的 {0} 小时。','Last related workout time plus your preferred {0} hours.'],
    ['同じトレーニング日の最終記録日時に、設定した{0}時間を加えています。','该训练日最近记录时间加上 {0} 小时。','Last record for this training day plus {0} hours.'],
    ['直近のセッション全体は{0}セット、重量×回数の合計は{1} kgでした。','最近一次训练共 {0} 组，重量 × 次数合计 {1} kg。','The latest session had {0} sets and {1} kg total weight × reps.'],
    ['入力されたRIRの最低値は{0}でした。','已记录的最低 RIR 为 {0}。','Lowest recorded RIR was {0}.'],
    ['最新のチェックが{0}時間を超えているか、対象の直近トレーニングより前です。現在の状態を確認してください。','最新自评已超过 {0} 小时或早于最近训练，请重新检查状态。','Your check-in is older than {0} hours or predates training. Check your current condition.'],
    ['疲労または対象部位の筋肉痛が{0}以上、もしくは「{1}」という報告があります。','疲劳或相关酸痛至少为 {0}，或主观感受为「{1}」。','Reported fatigue or soreness is at least {0}, or you feel “{1}”.'],
    ['疲労や対象部位の筋肉痛が{0}以上、「{1}」、睡眠が{2}時間未満、または睡眠の質が{3}以下の入力があります。','疲劳或酸痛至少为 {0}、感受为「{1}」、睡眠少于 {2} 小时或质量不高于 {3}。','Fatigue/soreness is at least {0}, feeling is “{1}”, sleep is under {2} hours, or quality is {3} or below.'],
    ['{0}セット以上、またはRIR {1}以下の記録は負担を確認するための参考情報です。候補日時は設定した間隔で計算します。','至少 {0} 组或 RIR 不高于 {1} 用于提示训练负担。候选时间仍按设定间隔计算。','At least {0} sets or RIR at most {1} are workload signals. Candidate dates still use your chosen interval.'],
    ['設定の刻み幅が大きい場合は増量を見送ります（目安は現在の重量の{0}%まで）。','档位过大时暂缓增重（参考上限为当前重量的 {0}%）。','Large increments are held back (limit {0}% of current weight).'],
    ['対象セットのRIRは{0}以上でした。設定した刻み幅での増加率は約{1}%です。','比较组 RIR 至少为 {0}，按设定档位增幅约 {1}%。','Work-set RIR was at least {0}. The configured increment adds about {1}%.'],
    ['同じ重量で代表セットの回数が{0}回減りました。','同重量下代表组减少 {0} 次。','Representative reps at the same weight decreased by {0}.'],
    ['間隔は{0}〜{1}時間の整数で入力してください。','间隔请输入 {0}–{1} 小时的整数。','Enter a whole-number interval from {0} to {1} hours.'],
  ].map(([ja,zh,en])=>({pattern:new RegExp('^'+ja.split(/\{\d\}/).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('(.+?)')+'$'),zh,en}));
  function translate(text){
    if(language==='ja')return text;
    const trimmed=text.trim();
    if(customNames.includes(trimmed))return text;
    if(trimmed.includes('・') && trimmed.split('・').every(part=>lookup.has(part)))return trimmed.split('・').map(part=>lookup.get(part)[language]).join(' · ');
    if(lookup.has(trimmed))return text.replace(trimmed,lookup.get(trimmed)[language]);
    for(const template of templates){const match=trimmed.match(template.pattern);if(match)return template[language].replace(/\{(\d)\}/g,(_,i)=>translate(match[Number(i)+1]));}
    const protectedNames=[];
    let source=text;
    for(const name of customNames){if(source.includes(name)){const index=protectedNames.push(name)-1;source=source.split(name).join(`\uE000${index}\uE001`);}}
    return source.replace(/(\d+)年(\d+)月(\d+)日/g,'$1/$2/$3')
      .replace(/\(([月火水木金土日])\)/g,(_,day)=>`(${lookup.get(day)[language]})`)
      .replace(/(\d+)回/g,(_,count)=>`${count}${language==='en'?' reps':'次'}`)
      .replace(pattern,match=>lookup.get(match)[language])
      .replace(/\uE000(\d+)\uE001/g,(_,index)=>protectedNames[Number(index)]);
  }
  function apply(){
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      const node=walker.currentNode;
      if(node.parentElement.closest('script,style,#language-select,input,textarea,[data-no-translate]'))continue;
      let saved=originals.get(node);
      if(!saved||node.textContent!==saved.output)saved={source:node.textContent};
      saved.output=translate(saved.source);originals.set(node,saved);
      if(node.textContent!==saved.output)node.textContent=saved.output;
    }
    for(const element of document.querySelectorAll('[aria-label],[title],[placeholder]')){
      if(element.closest('#language-select,[data-no-translate]'))continue;
      const values=attributes.get(element)||{};
      for(const name of ['aria-label','title','placeholder']){
        if(!element.hasAttribute(name))continue;
        const current=element.getAttribute(name);
        if(!values[name]||values[name].output!==current)values[name]={source:current};
        const value=values[name];value.output=translate(value.source);
        if(current!==value.output)element.setAttribute(name,value.output);
      }
      attributes.set(element,values);
    }
    document.documentElement.lang=language==='zh'?'zh-CN':language;
  }
  function start(){
    const select=document.getElementById('language-select');select.value=language;
    const observer=new MutationObserver(()=>{observer.disconnect();apply();observe();});
    function observe(){observer.observe(document.body,{childList:true,subtree:true,characterData:true});}
    select.addEventListener('change',()=>{language=select.value;try{localStorage.setItem('haoFitnessLog:language',language);}catch{}observer.disconnect();apply();observe();});
    apply();observe();
  }
  window.FitnessI18n={start,translate,setNames,get language(){return language;}};
})();

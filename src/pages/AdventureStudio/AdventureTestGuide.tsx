import { useState } from 'react'
import type { ReactNode } from 'react'
import { Alert, Button, Drawer, Space, Tag, Typography } from 'antd'
import { ReadOutlined } from '@ant-design/icons'
import { useAdventureCapabilities } from '../../api/queries'
import { useAnalyticsMeta } from '../../api/meta'
import { isSuperAdmin } from '../../components/access/role'

/**
 * 冒险故事测试指引（仅 staging 白名单样机）。
 *
 * 内容全部来自 deda-server 当前实现：固定话术、状态名、门禁、超时与自愈行为都以
 * 服务端代码为准，这里只做测试同学可执行的转述。统一退出话术刻意不内联——从
 * capabilities.fixedExitText 读，避免与 deda-server 的 ADVENTURE_EXIT_TEXT 漂移。
 *
 * 入口有两处：Adventure Studio「样机下发」tab（superadmin 现场用）与
 * 「内容与质量 → 冒险故事」卡片（普通 admin 也可读）。capabilities 只在 superadmin
 * 时请求；普通 admin 用占位符，不发这发必 403 的请求。
 */
export default function AdventureTestGuide() {
  const [open, setOpen] = useState(false)
  // 普通 admin 也会从内容页打开这份指引；capabilities 是 superadmin 接口，
  // 非超管不发这发必 403 的请求，退出话术回落到占位符（纯文案，UI 不变）。
  const superadmin = isSuperAdmin(useAnalyticsMeta().data)
  const capabilities =
    useAdventureCapabilities({ enabled: superadmin }).data ?? null
  const fixedExitText = capabilities?.fixedExitText

  return (
    <>
      <Button
        icon={<ReadOutlined />}
        aria-label="测试指引"
        onClick={() => setOpen(true)}
      >
        测试指引
      </Button>
      <Drawer
        title="冒险故事测试指引"
        open={open}
        onClose={() => setOpen(false)}
        size={760}
        destroyOnHidden
      >
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Space size={6} wrap>
            <Tag color="blue">staging only</Tag>
            <Tag color="geekblue">白名单样机</Tag>
            <Tag color="orange">百度 RTC 主链路</Tag>
          </Space>

          <Alert
            type="warning"
            showIcon
            title="staging 样机走百度 RTC 主链路：互动点没有 10 秒沉默兜底"
            description="主链路没有服务器推送通道，孩子停在互动点不开口就不会自动推进；必须由孩子说话（回答、跑题或说退出）来结束等待。这是设计差异，不是故障。"
          />

          <Section title="0. 适用边界（先读这一段）">
            <Bullet>
              本指引只适用于 staging 的测试设备白名单样机；白名单是设备级，不是账号级。
            </Bullet>
            <Bullet>
              页面只对 superadmin 开放；写操作还要求当前环境是 authoring（staging 已是
              authoring，只读环境不能下发/清除）。
            </Bullet>
            <Bullet>
              只有 staging 打开了 ADVENTURE_TEST_MODE_ENABLED；prod 说「测试冒险故事」会按普通对话处理。
            </Bullet>
            <Bullet>
              同一台设备同一时间只有一条冒险线；不同设备的状态、白名单、下发关系和超时计时器彼此隔离，可以并行测试。
            </Bullet>
          </Section>

          <Section title="1. 开测前置">
            <Bullet>
              设备必须在「运维与配置 → 测试设备白名单」里处于「在册」；添加/撤销理由不得少于 8 个字，记录在设备白名单行上。
            </Bullet>
            <Bullet>
              下发路径：冒险内容工作台 → 故事集 → 打开一集 → 「样机下发」→ 选择白名单样机 → 「下发当前集」。
              每台设备同时只记一集，重新下发会覆盖旧关系。
            </Bullet>
            <Bullet>
              下发/清除都会写审计；如果返回 audited=false，说明动作已生效但审计没写进去，必须人工记录时间与理由。
            </Bullet>
            <Bullet>
              非白名单设备说触发词会静默回落普通对话，不会收到「还没有下发」的确定性话术，避免暴露测试功能。
            </Bullet>
            <Bullet>
              白名单设备但没有下发时，说「测试冒险故事」会收到固定话术：
              「这台设备还没有下发测试冒险故事，请先在看板里给这台设备指定一集。」不写库、不调 LLM。
            </Bullet>
            <Bullet>
              测试前确认两台样机的 deviceId 不同；克隆成同一个 deviceId 会互相踩进度与当日记录。
            </Bullet>
          </Section>

          <Section title="2. 两条入口，不要混用">
            <Bullet>
              <Typography.Text strong>测试触发词「测试冒险故事」</Typography.Text>
              ：ASR 文本包含这几个字即命中（容忍句末标点）。每次从第 0 段重开并包含 recap；
              绕过每日一集门禁与顺序选集；优先锁最新草稿，否则锁当前发布版；允许覆盖当天的完集记录。
            </Bullet>
            <Bullet>
              测试触发词仍然先过 L1 安全闸；互动接话/二选一判定仍然会走 L2，不因为测试模式而豁免安全。
            </Bullet>
            <Bullet>
              <Typography.Text strong>正常每日冒险</Typography.Text>
              ：只有 adventure_story / free_story 会尝试进入；今日已完成时被门禁挡住；
              按 characterKey + season 1 + episodeNumber 升序选集；新分配播 recap，续玩不播 recap。
            </Bullet>
            <Bullet>
              同一台设备同一天不要把两条路径混着测：测试触发词会改写当天 daily 行并清空 completedDate；
              改下发后下次触发测试也会把 daily 指到另一集。并行验证两条路径请用两台设备。
            </Bullet>
            <Bullet>
              触发词排在等待态接管之前：玩到一半说「测试冒险故事」也会直接重开；
              非白名单设备说这句话则不会被测试入口拦住，可能被当成当前互动点的回答。
            </Bullet>
          </Section>

          <Section title="3. 下发、清除、撤销">
            <Bullet>
              下发优先锁最新草稿，否则锁当前发布版。锁的是 versionId；之后发布新版本不会换掉已在播的测试。
            </Bullet>
            <Bullet>
              <Typography.Text strong>草稿不是不可变快照</Typography.Text>
              ：保存草稿会原地更新同一个 version 行，而引擎按 versionId 做内存缓存。
              测草稿时不要中途保存草稿；要稳定复现请下发当前发布版。
            </Bullet>
            <Bullet>
              下发不校验角色匹配：可以把 Polly 的集下发给 Elly 设备。旁白按指定集播，
              但互动接话人设取设备自己的 characterKey，会出现内容与角色错配；只有刻意验证时才这样做。
            </Bullet>
            <Bullet>
              列表里的「旧快照」只表示重新下发会选到更新的版本，当前播放仍按设备锁定的旧版本走，不是故障。
            </Bullet>
            <Bullet>
              清除下发只清设备的两条下发字段；只有当前下发的正是这一集才会成功，否则服务端返回 409。
              撤销白名单是软删除并清空下发字段，不主动中断已经开始的测试会话。
            </Bullet>
            <Bullet>
              清除/撤销都不会删除已有的 progress 与 daily。旧集的进度行不会被自动收口；
              不要在等回答时直接切换下发，先退出或完成当前集。
            </Bullet>
            <Bullet>
              下发一集没有任何段落时，引擎会直接按完集落库，孩子可能听不到有效旁白；下发前先确认集里有内容。
            </Bullet>
          </Section>

          <Section title="4. 状态、每日门禁、选集、跨天">
            <Bullet>
              进度状态只有六种：in_progress（在玩）、awaiting_reply（停在互动点）、
              exited（孩子退出、当天可续）、completed（完集、永久排除）、
              failed_over（故障自愈收走、内容修好后可重新分配）、abandoned（下架收走、永久排除）。
            </Bullet>
            <Bullet>
              每日门禁只看当天是否已有一集 completed：有则不再调用 startToday，写
              entry_blocked_completed 与 routed_other_mode，落到自由故事；英语/成语等明确意图仍被尊重。
            </Bullet>
            <Bullet>
              选集：characterKey + season 1，按 episodeNumber 升序找第一个可播集；
              跳过 retired 与 completed/abandoned；failed_over 不排除；未发布是硬边界，宁可停播也不跳过它去播后面的集；全部完成则返回自由故事。
            </Bullet>
            <Bullet>
              完集会在同一事务里写 progress=completed、daily=completed、completedDate 与 completed 事件；
              这一集之后永久排除。跨天未完成会继续原集，assignedDate 保持不变，completedDate 记实际完集那天。
            </Bullet>
            <Bullet>
              「今天」用服务器本地时区。staging 容器若没有额外注入 TZ，默认是 UTC，
              日界会落在北京时间 08:00；开测前向运维确认实际 TZ，不要按手机零点判断跨天。
            </Bullet>
            <Bullet>
              每日完成后，正常故事请求被门禁挡住，不能换集、不能重听；测试触发词仍可从第 0 段重播，
              因为它允许覆盖完集记录。测完记得这台设备当天的正常额度已被改写。
            </Bullet>
            <Bullet>
              failed_over 不是永久失败：下一次正常选集仍可能重新分到同一集；abandoned 才是永久排除。
            </Bullet>
          </Section>

          <Section title="5. 孩子行为与互动原语">
            <Bullet>
              二选一：只在 ASR 文本里做选项 text 的完整子串匹配，选项 key 绝不参与。
              说「第二个」通常不命中；必须说出选项文案（可带前后话）。
            </Bullet>
            <Bullet>
              同时提到两个选项算多命中；命中词前 4 个字内出现「不/别/甭/勿」会触发否定守卫，
              不判命中。两种情况都落到跑题分支。
            </Bullet>
            <Bullet>
              二选一 LLM 兜底默认关；只有部署显式打开 ADVENTURE_CHOICE_LLM_ENABLED=true 才开启。
              开与关是两套预期，开测前先确认 staging 的值。
            </Bullet>
            <Bullet>
              首次没匹配上：接住并轻引回一次，仍停在原互动点；第二次没匹配上：播 fallbackText 并推进。
              offTopicCount 在每个新的互动点重置。
            </Bullet>
            <Bullet>
              开放问答：正常回答、跑题、超前发挥都走接话层，接话后照常播原文；代码层不判断孩子是否带跑剧情，
              靠提示词约束「不确认、不否认、不续写」。接话失败降级为 fallbackText。
            </Bullet>
            <Bullet>
              跟我念：孩子说什么都算成功，播 praise 并推进，不判发音；奖励原语自动加星并推进，不进入等待。
            </Bullet>
            <Bullet>
              空 ASR/语气词在二选一里按空文本走跑题；复述整段引导词（含两个选项）会多命中，不会误判成某个选项。
            </Bullet>
            <Bullet>
              等待互动时，除退出词外的话都先由冒险接管，不会切到英语/自由聊天；要切模式必须先说退出。
              旁白播放中说非退出话则返回 null，交回意图路由——等待态与旁白态的行为不同。
            </Bullet>
          </Section>

          <Section title="6. 中途退出与续玩（重点）">
            <Bullet>
              退出词是子串匹配、大小写不敏感：不要听 / 不想听 / 不想玩 / 不玩了 / 不要玩了 /
              退出 / 停止 / 结束 / 别讲了 / stop / quit / exit。答句里出现「结束」「停止」也会退出，写其他用例的话术时要避开。
            </Bullet>
            <Bullet>
              退出在任何阶段都接管，固定播：
              <Typography.Text code>
                {fixedExitText ?? '（以 capabilities.fixedExitText 为准）'}
              </Typography.Text>
              ，进度落 exited。
            </Bullet>
            <Bullet>
              已经 exited 再说退出：只重复同一句，不写库、不触发续玩。
              completed/abandoned/failed_over 是终态，退出词不被冒险接管，会掉回普通意图路由。
            </Bullet>
            <Bullet>
              续玩只认 exited + 明确故事请求：从 nextSegmentOrder - 1 恢复，回到退出时未回答的那个互动点，
              不重播 recap、不换集。
            </Bullet>
            <Bullet>
              「测试冒险故事」每次从第 0 段重开，不是续玩入口。退出后要继续，请说普通故事请求
              （如「我想听故事」「继续冒险」），不要说触发词。
            </Bullet>
            <Bullet>
              已完成/abandoned/failed_over 不能续玩；failed_over 之后可能被重新分配到同一集，那是选集行为，不是续玩。
            </Bullet>
          </Section>

          <Section title="7. 完成、再听、换集">
            <Bullet>
              每日完成后，正常故事请求被门禁挡住，落到自由故事；同日不能通过正常链路换集或重听。
              这是每日额度，不是 bug。
            </Bullet>
            <Bullet>
              测试触发词仍可在同一天重播已完成的集，并且会清掉当天的 completedDate；正常链路随即又能进入冒险，
              所以测试设备的当日状态会与真实家庭不同。
            </Bullet>
            <Bullet>
              跨天后正常链路会从下一集继续；如果下一集未发布，宁可停播也不跳过它；
              已 retire 的集跳过，选后面的已发布集；全部完成则返回自由故事。
            </Bullet>
          </Section>

          <Section title="8. 超时（staging = 百度 RTC）">
            <Bullet>
              本 staging 的主链路没有 10 秒沉默兜底：适配层不落 waitingSince、也不注册超时推送，
              互动点会一直等孩子下一句。停着不推进不是故障。
            </Bullet>
            <Bullet>
              备用 vendor WS 链路才有 10 秒兜底：最后一个 chunk ack 后开始计时，到点播 fallbackText 并推进，
              结果事件记为 timeout；引擎每 2 秒扫一次过期等待，进程重启也能补触发。
            </Bullet>
            <Bullet>
              孩子先开口与超时到点存在竞态：超时检查会重新读 waitingSince，没到点就放弃，以先到的上行为准。
            </Bullet>
            <Bullet>
              最后一帧 ack 前断网时 waitingSince 为空，超时扫描永远扫不到；这种「没有下一句」需要人工重新触发，
              不是超时逻辑能兜住的。
            </Bullet>
          </Section>

          <Section title="9. 安全">
            <Bullet>
              L1 在测试触发词之前执行：敏感内容直接走安全话术，不会进入冒险。
            </Bullet>
            <Bullet>
              L2 只在真正调接话层/二选一判定时惰性触发；明确拦截时固定播
              「我们先回到故事里，好吗？」并且不推进进度。
            </Bullet>
            <Bullet>
              L2 不可用时是 fail-open，会注入谨慎指令；情绪伤害类会注入共情指令，不直接拦截。
              测试模式不绕过 L1/L2。
            </Bullet>
          </Section>

          <Section title="10. 故障自愈、巡检、版本">
            <Bullet>
              start_today / handle_reply / check_timeout 任一抛错会触发故障自愈：当前集标 failed_over，
              当天复用 daily 改指下一集（跨天则先收口旧行再建今天行），写 reassigned_after_failure，
              播下一集 recap；单轮最多平移一次。
            </Bullet>
            <Bullet>
              今日已完成、当前没有在飞冒险、或没有下一集时，自愈返回 null，由上层落自由故事或 L0 话术；
              兜底不得绕过每日额度。孩子突然听到下一集 recap，可能是自愈，不一定是串集。
            </Bullet>
            <Bullet>
              熔断器只标记与告警，不自动改内容、不自动切版本：默认 10 分钟内 5 次兜底失败跳闸，
              跳闸标记 1 小时；解除必须人工写理由并留审计。Redis 不可用时 degraded=true，此时「未跳闸」不代表健康。
            </Bullet>
            <Bullet>
              定时巡检会修段号溢出（等待态→exited）、等待态非互动段（→exited）、daily/progress 状态冲突；
              版本行缺失/损坏、segments 漂移只告警；陈旧等待默认 off（完全不扫），只有配成 alert/exit 才告警或改判。
              修复与告警都能在「自愈与兜底」面板看到。
            </Bullet>
            <Bullet>
              版本锁定：分配时记 episodeVersionId；发布新版本不影响在播孩子；版本行缺失或 payload 损坏时
              引擎回落 segments 表并告警；retire 不打断当天在播，跨天仍未完成才 abandoned。
            </Bullet>
          </Section>

          <Section title="11. 多设备与测试副作用">
            <Bullet>
              不同设备可以并行：progress、daily、白名单、下发字段、超时计时器都按设备隔离。
              多台设备可以下发同一集，事件按 daily/turn 隔离。
            </Bullet>
            <Bullet>
              同一台设备不能并行跑两条线；两台测试机克隆成同一个 deviceId 也不行。
            </Bullet>
            <Bullet>
              测试触发词的副作用：重置进度到第 0 段、改指/复用当天 daily、清空 completedDate、
              以带时间戳的事件键重写 assigned/started；这些是设计行为，不是脏数据。
            </Bullet>
            <Bullet>
              改下发的副作用：下次触发测试时把当天 daily 指到另一集；旧集的进度行不会被自动收口。
              撤销白名单只清下发字段，不清理已有 progress/daily。
            </Bullet>
            <Bullet>
              这些副作用只在 staging 测试设备上可接受，不要拿真实家庭设备测。
            </Bullet>
          </Section>

          <Section title="12. 看板取证">
            <Bullet>
              /test-devices：白名单在册/撤销、添加人与理由、环境是否启用。
            </Bullet>
            <Bullet>
              /adventure 的「故事集」→ 打开一集 →「样机下发」：已下发设备、锁定版本、草稿/发布版、
              旧快照、已下架；同一抽屉的「选项命中」可看确定性命中、LLM 命中与兜底率。
            </Bullet>
            <Bullet>
              /adventure?tab=audit：下发测试故事、清除测试故事、发布、下架、手动巡检、解除熔断；
              audited=false 需要人工补记。
            </Bullet>
            <Bullet>
              /adventure?tab=recovery：熔断器、最近巡检的 repairs/alerts/errors、最近引擎失败（phase/recovered）。
            </Bullet>
            <Bullet>
              /messages 按 deviceId + 模式「冒险故事」过滤：逐轮 ASR 与播报；消息详情「故事」块可跳
              「查看当时版本 vN」。/llm 的 intent/safety/adventure_interaction 可核对路由、安全与接话调用。
            </Bullet>
            <Bullet>
              看板没有逐设备 progress 状态的现成页面；状态只能从行为、消息、事件与巡检面板推断，
              需要看库时找工程配合，不要在生产库手改数据。
            </Bullet>
          </Section>

          <Section title="附录 A：固定话术速查">
            <Bullet>退出话术：{fixedExitText ?? '（以 capabilities.fixedExitText 为准）'}</Bullet>
            <Bullet>
              未下发：「这台设备还没有下发测试冒险故事，请先在看板里给这台设备指定一集。」
            </Bullet>
            <Bullet>L2 明确拦截：「我们先回到故事里，好吗？」</Bullet>
            <Bullet>冒险引擎故障降级：「哎呀，我刚刚走神了一下。我们聊点别的好不好？」</Bullet>
            <Bullet>链路最后兜底：「我在这儿呢，我们等一会儿再玩好不好？」</Bullet>
            <Bullet>互动兜底默认：「没关系，我们继续吧。」；跟我念默认表扬：「说得真好！给你鼓掌！」</Bullet>
            <Bullet>
              以上是代码默认/固定话术；选项 reply、fallbackText、praise 可能由每集内容覆盖，实际以该集内容为准。
            </Bullet>
          </Section>

          <Section title="附录 B：代码依据">
            <Bullet>
              deda-server：adventure.service.ts（开集/续玩、playFrom、handleChildReply、exitAdventure、
              checkTimeout、handleEngineFailure、recoverToNextEpisode、recordPresented、recordEntryBlocked、
              sweepTimeouts）；adventure-match.ts（二选一匹配与否定守卫）；
              adventure-progress.ts（状态与选集排除）；adventure.constants.ts（退出词、固定话术、测试开关）；
              safety-profile.ts（L2 固定话术）。
            </Bullet>
            <Bullet>
              deda-server：adventure-recovery.service.ts（detector 1–8 与修复/告警口径）；
              adventure-test-assign.service.ts（下发/清除/列表、草稿优先、旧快照）；
              device-test-access.service.ts（白名单、撤销语义）；schema.prisma（progress/daily 唯一键）；
              docker/docker-compose.staging.yml 与 compose-env-gate.spec.ts（仅 staging 打开测试模式）。
            </Bullet>
            <Bullet>
              deda-dashboard：TestDevices（白名单页）；AdventureStudio/EpisodeDetailDrawer（样机下发 tab）；
              DeviceTestAssign / DeviceTestAssignList（下发与旧快照标签）；ChoiceStatsPanel（选项命中）；
              HealthPanel / RecoveryActions（自愈与兜底）；Messages 与 MessageDetailDrawer（消息、当时版本）；
              Llm/scenes.ts（adventure_interaction 场景）。
            </Bullet>
          </Section>

          <Section title="附录 C：缺陷上报模板">
            <Bullet>deviceId / deviceCode、当前下发集与 versionId、测试路径（触发词 / 正常链路）。</Bullet>
            <Bullet>时间（含时区）、孩子原话 ASR、设备实际播报、期望行为、实际行为。</Bullet>
            <Bullet>
              看板取证：消息页 turn、选项命中、审计记录、自愈面板的 repairs/alerts/engineFailures；
              有 turnId 一并给出。
            </Bullet>
          </Section>
        </Space>
      </Drawer>
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
        {title}
      </Typography.Title>
      <Space orientation="vertical" size={6} style={{ width: '100%' }}>
        {children}
      </Space>
    </section>
  )
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <Typography.Text style={{ fontSize: 13, display: 'block', lineHeight: 1.7 }}>
      • {children}
    </Typography.Text>
  )
}

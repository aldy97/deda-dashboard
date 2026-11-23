import { useState } from 'react'
import { Alert, Button, Input, Space, Tag, Typography } from 'antd'
import { Link } from 'react-router-dom'
import type { ApiError } from '../../api/client'
import {
  useAssignTestStory,
  useClearTestStory,
  useDeviceTestAssignment,
} from '../../api/queries'
import ReasonDialog from './ReasonDialog'
import DeviceTestAssignList from './DeviceTestAssignList'
import { characterLabel } from './labels'

/**
 * 样机下发（仅 staging）：把当前这一集下发到指定设备。
 *
 * 孩子对样机说「测试冒险故事」即播放被下发的集，不限次数/顺序、可播草稿快照。
 * 状态真相在 device 字段上（不是 Redis 会话），所以这里只需要「下发 / 清除 /
 * 查看当前下发」三个动作，全部走理由弹窗 + 服务端审计，与内容变更同一套规则。
 *
 * 环境闸在服务端（ADVENTURE_TEST_MODE_ENABLED）：prod 下 testStoryEnabled=false，
 * 这里禁用按钮并说明原因，不假装功能可用。
 */
interface Props {
  episodeId: string
  /** 抽屉里这一集所属的 IP；列表按它查「同一 IP 下所有集」的下发设备 */
  characterKey: string | null
  authoring: boolean
  testStoryEnabled: boolean
}

type Action = 'assign' | 'clear'

interface ResultNote {
  tone: 'success' | 'warning' | 'error' | 'info'
  text: string
}

export default function DeviceTestAssign({
  episodeId,
  characterKey,
  authoring,
  testStoryEnabled,
}: Props) {
  const [deviceId, setDeviceId] = useState('')
  const [queried, setQueried] = useState<string | null>(null)
  const [action, setAction] = useState<Action | null>(null)
  const [result, setResult] = useState<ResultNote | null>(null)

  const assignmentQuery = useDeviceTestAssignment(queried)
  const assign = useAssignTestStory()
  const clear = useClearTestStory()

  const active = action === 'assign' ? assign : clear
  const error = (active.error as ApiError | null) ?? null
  const assignment = assignmentQuery.data ?? null

  function query() {
    const trimmed = deviceId.trim()
    setQueried(trimmed.length > 0 ? trimmed : null)
    setResult(null)
  }

  function submit(values: { reason: string }) {
    const target = deviceId.trim()
    if (!target) {
      setResult({ tone: 'error', text: '请先填写设备 ID（小写 MAC 或设备编码）。' })
      return
    }
    if (action === 'assign') {
      assign.mutate(
        { episodeId, deviceId: target, reason: values.reason },
        {
          onSuccess: (res) => {
            setAction(null)
            setQueried(target)
            if (!res.audited) {
              setResult({
                tone: 'error',
                text: '已下发，但审计没写进去（audited=false）。这一次动作没有留痕，请人工记录时间与理由。',
              })
              return
            }
            setResult({
              tone: 'success',
              text: `已下发「${res.assignment.title}」到 ${target}（${res.assignment.versionStatus === 'draft' ? '草稿快照' : '当前发布版'}）。孩子说「测试冒险故事」即可播放。`,
            })
          },
        },
      )
      return
    }
    clear.mutate(
      { episodeId, deviceId: target, reason: values.reason },
      {
        onSuccess: (res) => {
          setAction(null)
          setQueried(target)
          if (!res.audited) {
            setResult({
              tone: 'error',
              text: '已清除下发，但审计没写进去（audited=false）。这一次动作没有留痕，请人工记录时间与理由。',
            })
            return
          }
          setResult({ tone: 'success', text: `已清除 ${target} 的下发。` })
        },
      },
    )
  }

  const list = (
    <DeviceTestAssignList characterKey={characterKey} writable={authoring} />
  )

  if (!testStoryEnabled) {
    return (
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          测试冒险故事未启用：当前环境没有打开 ADVENTURE_TEST_MODE_ENABLED（prod
          永远不可用），孩子说「测试冒险故事」不会进入测试播放。
        </Typography.Text>
      </Space>
    )
  }

  if (!authoring) {
    return (
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          本环境只读，不能下发或清除测试冒险故事（这两个动作都会写审计）。
        </Typography.Text>
        {list}
      </Space>
    )
  }

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Space.Compact style={{ width: '100%' }}>
        <Input
          placeholder="设备 ID（小写 MAC）或设备编码"
          value={deviceId}
          onChange={(event) => setDeviceId(event.target.value)}
          onPressEnter={query}
          allowClear
        />
        <Button onClick={query} loading={assignmentQuery.isFetching}>
          查询当前下发
        </Button>
      </Space.Compact>

      <Space size={8} wrap>
        <Button
          type="primary"
          loading={assign.isPending}
          disabled={!deviceId.trim() || assignment?.whitelisted === false}
          onClick={() => setAction('assign')}
        >
          下发当前集
        </Button>
        <Button
          danger
          loading={clear.isPending}
          disabled={!deviceId.trim()}
          onClick={() => setAction('clear')}
        >
          清除下发
        </Button>
      </Space>

      {result && (
        <Alert
          type={result.tone}
          showIcon
          closable
          onClose={() => setResult(null)}
          message={result.text}
        />
      )}

      {assignmentQuery.isLoading && <Typography.Text type="secondary">正在读取…</Typography.Text>}

      {assignment && assignment.enabled && assignment.assignment && (
        <Space orientation="vertical" size={4} style={{ width: '100%' }}>
          <Typography.Text strong>当前下发</Typography.Text>
          <Space size={8} wrap>
            <Typography.Text code>{assignment.assignment.device.deviceId}</Typography.Text>
            {assignment.assignment.episode ? (
              <>
                <Typography.Text strong>{assignment.assignment.episode.title}</Typography.Text>
                <Tag>{characterLabel(assignment.assignment.episode.characterKey)}</Tag>
                <Tag color={assignment.assignment.episodeVersion ? 'blue' : 'green'}>
                  {assignment.assignment.episodeVersion
                    ? `草稿 v${assignment.assignment.episodeVersion.version}`
                    : '当前发布版'}
                </Tag>
              </>
            ) : (
              <Typography.Text type="secondary">（无）</Typography.Text>
            )}
          </Space>
        </Space>
      )}

      {assignment && assignment.enabled && !assignment.assignment && queried && (
        <Typography.Text type="secondary">该设备当前没有下发任何测试故事。</Typography.Text>
      )}

      {assignment && assignment.enabled && assignment.whitelisted === false && (
        <Alert
          type="warning"
          showIcon
          message="该设备不在测试设备白名单里，不能下发测试冒险故事"
          description={
            <Typography.Text>
              请先到 <Link to="/test-devices">运维与配置 → 测试设备白名单</Link>{' '}
              添加这台设备，然后重新查询再下发。白名单同时管「测试冒险故事」与「测试哄睡模式」。
            </Typography.Text>
          }
        />
      )}

      {list}

      {action === 'assign' && (
        <ReasonDialog
          key="assign"
          open
          title="下发当前集到样机"
          okText="确认下发"
          pending={assign.isPending}
          error={error}
          onCancel={() => setAction(null)}
          onSubmit={submit}
          description={
            <Space orientation="vertical" size={6} style={{ width: '100%' }}>
              <Typography.Text>
                把当前这一集下发到 <Typography.Text code>{deviceId.trim() || '（未填写设备）'}</Typography.Text>：
                孩子对它说「测试冒险故事」即从第 0 段播放，不限次数、不限顺序。
                有草稿时锁草稿快照，否则锁当前发布版本。
              </Typography.Text>
              <Typography.Text type="secondary">
                会落一条审计。下发后设备当前的下发关系被覆盖（每台设备同时只记一集）。
              </Typography.Text>
            </Space>
          }
        />
      )}

      {action === 'clear' && (
        <ReasonDialog
          key="clear"
          open
          title="清除样机下发"
          okText="确认清除"
          danger
          pending={clear.isPending}
          error={error}
          onCancel={() => setAction(null)}
          onSubmit={submit}
          description={
            <Space orientation="vertical" size={6} style={{ width: '100%' }}>
              <Typography.Text>
                清除 <Typography.Text code>{deviceId.trim() || '（未填写设备）'}</Typography.Text>{' '}
                当前的测试冒险故事下发。清除后孩子说「测试冒险故事」会得到「还没有下发」的确定性回复。
              </Typography.Text>
              <Typography.Text type="secondary">
                只有该设备当前下发的正是这一集才会被清除，否则服务端会拒绝（409）。
              </Typography.Text>
            </Space>
          }
        />
      )}
    </Space>
  )
}

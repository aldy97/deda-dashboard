import { Card, Empty, Typography } from 'antd'

interface PlaceholderPageProps {
  title: string
  description: string
  apis: string[]
}

/** 后端接口未上线前的页面占位：说明页面定位与将接入的接口清单 */
export default function PlaceholderPage({
  title,
  description,
  apis,
}: PlaceholderPageProps) {
  return (
    <Card>
      <Empty
        description={
          <>
            <Typography.Title level={5} style={{ marginBottom: 8 }}>
              {title}
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ maxWidth: 560, margin: '0 auto 12px' }}>
              {description}
            </Typography.Paragraph>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              待接入接口：
            </Typography.Text>
            <div style={{ marginTop: 8 }}>
              {apis.map((api) => (
                <div key={api}>
                  <Typography.Text code style={{ fontSize: 12 }}>
                    {api}
                  </Typography.Text>
                </div>
              ))}
            </div>
          </>
        }
      />
    </Card>
  )
}

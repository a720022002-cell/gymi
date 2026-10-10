import { Text } from '../Text';
import { Row, Springy } from '../ui';

/** Section title with an optional link on the right (design: secHead). */
export function SecHead({ title, link, onLink }: { title: string; link?: string; onLink?: () => void }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: 20, marginBottom: 8, marginHorizontal: 4 }}>
      <Text variant="h3">{title}</Text>
      {link ? (
        <Springy onPress={onLink}>
          <Text variant="small" weight={700} color="link">
            {link}
          </Text>
        </Springy>
      ) : null}
    </Row>
  );
}

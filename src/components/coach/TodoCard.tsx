import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { useT } from '@/i18n';
import { addTodo, deleteTodo, listTodos, setTodoDone, type Todo, TODO_DUE } from '@/lib/coaching';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Card, Chip, Row, Springy } from '../ui';

/** Coach's to-do list for one client, only the coach sees it (design: todoCard). */
export function TodoCard({ link, name, onChange }: { link: string; name: string; onChange?: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const [list, setList] = useState<{ link: string; v: Todo[] } | null>(null);
  const [text, setText] = useState('');
  const [due, setDue] = useState<Todo['due']>(null);

  useEffect(() => {
    let alive = true;
    listTodos(link).then((v) => alive && setList({ link, v }));
    return () => {
      alive = false;
    };
  }, [link]);

  const T = list?.link === link ? list.v : [];
  const set = (v: Todo[]) => {
    setList({ link, v });
    onChange?.();
  };
  const open = T.filter((x) => !x.done);
  const add = async () => {
    const v = text.trim();
    if (!v) return;
    setText('');
    const r = await addTodo(link, v, due);
    setDue(null);
    if (!r) {
      setText(v);
      return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    }
    set([...T, r]);
  };
  const del = async (x: Todo) => {
    const before = T;
    set(T.filter((y) => y.id !== x.id));
    if (!(await deleteTodo(x.id))) return set(before);
    toast(t('Task removed'), {
      icon: 'trash',
      undo: async () => {
        const r = await addTodo(link, x.text, x.due, x.id);
        if (r) {
          if (x.done) await setTodoDone(r.id, true);
          set([...before]);
        }
      },
    });
  };
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text weight={700}>{t('To-do for {n}', { n: name })}</Text>
        {open.length ? (
          <Text variant="xs" weight={700} color="sec">
            {t('{n} open', { n: open.length })}
          </Text>
        ) : null}
      </Row>
      {!T.length ? (
        <Text variant="small" color="sec" style={{ marginTop: 4 }}>
          {t('Things to remember for {n}. Only you see this.', { n: name })}
        </Text>
      ) : null}
      <View style={{ marginTop: 4 }}>
        {[...open, ...T.filter((x) => x.done)].map((x) => (
          <Row key={x.id} gap={10} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.line }}>
            <Springy
              accessibilityLabel={t(x.done ? 'Mark not done' : 'Mark done')}
              onPress={async () => {
                set(T.map((y) => (y.id === x.id ? { ...y, done: !y.done } : y)));
                if (!(await setTodoDone(x.id, !x.done))) set(T);
              }}
              style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: x.done ? c.cobalt : 'transparent', borderWidth: x.done ? 0 : 2, borderColor: c.line }}>
              {x.done ? <Icon name="check" size={13} color="#FFFFFF" strokeWidth={3} /> : null}
            </Springy>
            <View style={{ flex: 1 }}>
              <Text variant="small" color={x.done ? 'sec' : 'text'} style={x.done ? { textDecorationLine: 'line-through' } : undefined}>
                {x.text}
              </Text>
              {x.due ? (
                <Text variant="xs" weight={700} color={x.done ? 'sec' : c.cobalt}>
                  {t(x.due)}
                </Text>
              ) : null}
            </View>
            <Springy accessibilityLabel={t('Delete')} onPress={() => del(x)} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={13} color={c.sec} strokeWidth={2.2} />
            </Springy>
          </Row>
        ))}
      </View>
      <Row gap={8} style={{ marginTop: 8 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={add}
          maxLength={200}
          placeholder={t('Add a task, like: Check squat form')}
          placeholderTextColor={c.sec}
          style={{ flex: 1, minWidth: 0, height: 44, borderRadius: 14, backgroundColor: c.inset, paddingHorizontal: 12, fontSize: 15, color: c.text }}
        />
        <Springy accessibilityLabel={t('Add task')} onPress={add} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.cobalt, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="plus" size={18} color="#FFFFFF" strokeWidth={2.4} />
        </Springy>
      </Row>
      <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 8 }}>
        {TODO_DUE.map((d) => (
          <Chip key={d} title={t(d)} on={due === d} onPress={() => setDue(due === d ? null : d)} />
        ))}
      </Row>
    </Card>
  );
}

import { useEffect } from 'react';
import { Alert } from 'react-native';

import type { AccountChoice } from '@/core/sync/controller';
import { sync } from '@/core/sync/sync';
import { useSyncView } from '@/core/sync/use-sync';

export const ACCOUNT_CHOICE = {
  title: 'This phone has another account’s data',
  message:
    'Keep it to add it to the account you signed in with, or replace it with that account’s data.',
  keepLocal: 'Keep this data',
  startFresh: 'Use the account’s data',
};

export const chooseAccountData = (choice: AccountChoice) =>
  void sync
    .choose(choice)
    .catch(() =>
      Alert.alert(
        'Couldn’t switch accounts',
        'Nothing was changed. Try again from Settings.',
      ),
    );

/** Asks once what to do when the signed-in account isn't the one this phone's data belongs to. */
export function useAccountChoice() {
  const { phase } = useSyncView();
  useEffect(() => {
    if (phase !== 'needsChoice') return;
    Alert.alert(
      ACCOUNT_CHOICE.title,
      ACCOUNT_CHOICE.message,
      [
        {
          text: ACCOUNT_CHOICE.keepLocal,
          onPress: () => chooseAccountData('keepLocal'),
        },
        {
          text: ACCOUNT_CHOICE.startFresh,
          style: 'destructive',
          onPress: () => chooseAccountData('startFresh'),
        },
      ],
      { cancelable: false },
    );
  }, [phase]);
}

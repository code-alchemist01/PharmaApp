/**
 * DrugListItem - İlaç liste öğesi bileşeni
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { List } from 'react-native-paper';
import { Drug } from '../services/database/LocalDatabase';

interface DrugListItemProps {
  drug: Drug;
  onPress?: () => void;
}

const DrugListItem: React.FC<DrugListItemProps> = ({ drug, onPress }) => {
  return (
    <List.Item
      title={drug.name}
      description={drug.dosage || 'Dozaj belirtilmemiş'}
      left={(props) => <List.Icon {...props} icon="pill" color={props.color} />}
      right={(props) => <List.Icon {...props} icon="chevron-right" color={props.color} />}
      onPress={onPress}
      style={styles.item}
    />
  );
};

const styles = StyleSheet.create({
  item: {
    backgroundColor: 'white',
    marginBottom: 4,
  },
});

export default DrugListItem;


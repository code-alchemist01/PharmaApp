/**
 * DrugCard - İlaç kartı bileşeni
 */

import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Card, Text, Button } from 'react-native-paper';
import { Drug } from '../services/database/LocalDatabase';
import { base64ToUri } from '../utils/helpers';

interface DrugCardProps {
  drug: Drug;
  onPress?: () => void;
}

const DrugCard: React.FC<DrugCardProps> = ({ drug, onPress }) => {
  return (
    <Card style={styles.card} onPress={onPress}>
      {drug.image_base64 && (
        <Card.Cover
          source={{ uri: base64ToUri(drug.image_base64) }}
          style={styles.image}
        />
      )}
      <Card.Content>
        <Text variant="titleLarge" style={styles.name}>
          {drug.name}
        </Text>
        {drug.dosage && (
          <Text variant="bodyMedium" style={styles.dosage}>
            Dozaj: {drug.dosage}
          </Text>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    marginHorizontal: 4,
    flex: 1,
    maxWidth: '48%', // 2 sütun için
  },
  image: {
    height: 150,
    resizeMode: 'contain',
  },
  name: {
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
    fontSize: 14,
  },
  dosage: {
    color: 'gray',
    fontSize: 12,
  },
});

export default DrugCard;


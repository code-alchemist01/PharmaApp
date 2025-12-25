/**
 * SwipeableRow - Swipe actions için reusable component
 */

import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { IconButton, Button } from 'react-native-paper';

interface SwipeableRowProps {
  children: React.ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  rightActions?: React.ReactNode;
  leftActions?: React.ReactNode;
}

const SwipeableRow: React.FC<SwipeableRowProps> = ({
  children,
  onEdit,
  onDelete,
  rightActions,
  leftActions,
}) => {
  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    if (rightActions) {
      return rightActions;
    }

    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.rightActions}>
        {onEdit && (
          <Animated.View style={[styles.actionButton, { transform: [{ scale }] }]}>
            <IconButton
              icon="pencil"
              iconColor="#fff"
              size={24}
              onPress={onEdit}
              style={[styles.editButton, styles.actionIcon]}
            />
          </Animated.View>
        )}
        {onDelete && (
          <Animated.View style={[styles.actionButton, { transform: [{ scale }] }]}>
            <IconButton
              icon="delete"
              iconColor="#fff"
              size={24}
              onPress={onDelete}
              style={[styles.deleteButton, styles.actionIcon]}
            />
          </Animated.View>
        )}
      </View>
    );
  };

  const renderLeftActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    if (leftActions) {
      return leftActions;
    }
    return null;
  };

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      rightThreshold={40}>
      {children}
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 8,
  },
  actionButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    height: '100%',
  },
  actionIcon: {
    margin: 0,
  },
  editButton: {
    backgroundColor: '#2196F3',
  },
  deleteButton: {
    backgroundColor: '#d32f2f',
  },
});

export default SwipeableRow;

